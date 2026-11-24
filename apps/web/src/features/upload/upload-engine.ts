'use client';

import { apiFetch } from '@/lib/diagnostics/api';

/** SPEC §6.3/§7.1 client rules. */
export const MAX_FILES = 50;
export const MAX_UPLOAD_MB = 30;
export const PARALLEL_UPLOADS = 3;
export const MAX_RETRIES = 3;
export const RETRY_DELAYS_MS = [1000, 2000, 4000];
const ACCEPTED = new Set(['image/jpeg', 'image/png', 'image/webp']);

export type Rejection = { name: string; reason: 'heic' | 'type' | 'size' };

const isHeic = (file: File) => /^image\/hei[cf]/.test(file.type) || /\.(heic|heif)$/i.test(file.name);

/** Rejects HEIC, non-JPEG/PNG/WebP and files over 30 MB before any request (SPEC §7.1 step 1). */
export const screenFiles = (files: File[], maxMb = MAX_UPLOAD_MB): { accepted: File[]; rejected: Rejection[] } => {
  const accepted: File[] = [];
  const rejected: Rejection[] = [];
  for (const file of files) {
    if (isHeic(file)) rejected.push({ name: file.name, reason: 'heic' });
    else if (!ACCEPTED.has(file.type)) rejected.push({ name: file.name, reason: 'type' });
    else if (file.size > maxMb * 1024 * 1024) rejected.push({ name: file.name, reason: 'size' });
    else accepted.push(file);
  }
  return { accepted, rejected };
};

export type Ticket = { photoId: string; uploadUrl: string; uploadKey: string };

export class UploadError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

const errorFrom = async (response: Response): Promise<UploadError> => {
  const body = (await response.json().catch(() => ({}))) as { message?: string; code?: string };
  return new UploadError(body.message ?? `HTTP ${response.status}`, response.status, body.code);
};

export type UploadTarget = { token?: string; slug?: string };

/** `POST …/uploads`: one ticket (photo id, signed URL, secret key) per file. */
export const requestTickets = async (
  target: UploadTarget,
  body: { category: 'wedding' | 'memories'; senderName: string; message: string; files: File[] },
): Promise<Ticket[]> => {
  const path = target.token
    ? `/api/public/invitations/${encodeURIComponent(target.token)}/uploads`
    : `/api/public/weddings/${encodeURIComponent(target.slug ?? '')}/uploads`;
  const response = await apiFetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      category: body.category,
      senderName: body.senderName,
      message: body.message,
      files: body.files.map((file) => ({ name: file.name, type: file.type, size: file.size })),
    }),
  });
  if (!response.ok) throw await errorFrom(response);
  return ((await response.json()) as { uploads: Ticket[] }).uploads;
};

/** Outcome of one PUT attempt: `ambiguous` means the object may or may not be stored. */
export type PutResult = 'stored' | 'exists' | 'ambiguous' | 'rejected';
export type Transport = (url: string, file: File, onProgress: (loaded: number) => void) => Promise<PutResult>;

/** Direct PUT to Storage with upload progress (fetch cannot report upload progress). */
export const xhrPut: Transport = (url, file, onProgress) =>
  new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('content-type', file.type);
    xhr.upload.onprogress = (event) => onProgress(event.loaded);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve('stored');
      else if (xhr.status === 409) resolve('exists');
      else if (xhr.status >= 500 || xhr.status === 0) resolve('ambiguous');
      else resolve('rejected');
    };
    xhr.onerror = () => resolve('ambiguous');
    xhr.ontimeout = () => resolve('ambiguous');
    xhr.send(file);
  });

export type CompleteResult =
  { kind: 'done'; status: string } | { kind: 'missing' } | { kind: 'final'; message: string } | { kind: 'retry' };

export const completeUpload = async (ticket: Ticket): Promise<CompleteResult> => {
  let response: Response;
  try {
    response = await apiFetch(`/api/public/uploads/${encodeURIComponent(ticket.photoId)}/complete`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ uploadKey: ticket.uploadKey }),
    });
  } catch {
    return { kind: 'retry' };
  }
  if (response.ok) return { kind: 'done', status: ((await response.json()) as { status: string }).status };
  const error = await errorFrom(response);
  if (error.code === 'uploadNotFound') return { kind: 'missing' };
  // notImage / tooLarge / storageLimit: the server removed the photo; retrying cannot help.
  if (response.status === 403 || response.status === 404 || response.status === 422) {
    return { kind: 'final', message: error.message };
  }
  return { kind: 'retry' };
};

export type FileState =
  | { phase: 'queued' }
  | { phase: 'uploading'; loaded: number }
  | { phase: 'processing' }
  | { phase: 'done'; status: string }
  | { phase: 'failed' }
  | { phase: 'rejected'; message: string };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * One file through PUT and `complete` (SPEC §7.1 steps 3–5): the same photo id and
 * path for every attempt, up to {@link MAX_RETRIES} retries with backoff, and after
 * an ambiguous PUT `complete` is tried before re-uploading.
 */
export const sendOne = async (
  ticket: Ticket,
  file: File,
  onState: (state: FileState) => void,
  { transport = xhrPut, delays = RETRY_DELAYS_MS }: { transport?: Transport; delays?: number[] } = {},
): Promise<FileState> => {
  let checkFirst = false;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) await sleep(delays[attempt - 1] ?? delays.at(-1) ?? 1000);
    if (checkFirst) {
      // The previous attempt may have stored the file: completing avoids a re-upload.
      onState({ phase: 'processing' });
      const probe = await completeUpload(ticket);
      if (probe.kind === 'done') return finish({ phase: 'done', status: probe.status });
      if (probe.kind === 'final') return finish({ phase: 'rejected', message: probe.message });
    }
    onState({ phase: 'uploading', loaded: 0 });
    const put = await transport(ticket.uploadUrl, file, (loaded) => onState({ phase: 'uploading', loaded }));
    if (put === 'ambiguous') {
      checkFirst = true;
      continue;
    }
    // A 4xx from Storage (wrong type, too large, expired URL) will not change on retry.
    if (put === 'rejected') return finish({ phase: 'failed' });
    onState({ phase: 'processing' });
    const result = await completeUpload(ticket);
    if (result.kind === 'done') return finish({ phase: 'done', status: result.status });
    if (result.kind === 'final') return finish({ phase: 'rejected', message: result.message });
    checkFirst = result.kind === 'retry';
  }
  return finish({ phase: 'failed' });

  function finish(state: FileState): FileState {
    onState(state);
    return state;
  }
};

/** Runs `tasks` with at most `limit` in flight (SPEC §7.1: three parallel PUTs). */
export const runLimited = async <T>(tasks: (() => Promise<T>)[], limit = PARALLEL_UPLOADS): Promise<T[]> => {
  const results: T[] = new Array(tasks.length);
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const index = next++;
      results[index] = await (tasks[index] as () => Promise<T>)();
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
};
