'use client';

import { makeZip } from 'client-zip';

import { apiFetch } from '@/lib/diagnostics/api';

import { ApiLoadError } from './signed-photos';

export type OriginalFile = { id: string; filename: string; url: string; size: number };
export type OriginalsPage = { photos: OriginalFile[]; nextCursor: string | null; total: number; totalBytes: number };
export type DownloadScope = 'approved' | 'all';

/** Above this the organizer is warned before starting (UC-85). */
export const LARGE_DOWNLOAD_BYTES = 2_000_000_000;
/** Fallback archives are built one at a time and never exceed this many bytes. */
export const FALLBACK_BATCH_BYTES = 200_000_000;
const PAGE_SIZE = 100;

const jsonOrThrow = async <T>(response: Response): Promise<T> => {
  const body = (await response.json().catch(() => ({}))) as T & { message?: string; code?: string };
  if (!response.ok) throw new ApiLoadError(body.message ?? `HTTP ${response.status}`, response.status, body.code);
  return body;
};

export const fetchOriginalsPage = async (
  eventId: string,
  status: DownloadScope,
  cursor: string | null = null,
  limit = PAGE_SIZE,
): Promise<OriginalsPage> => {
  const search = new URLSearchParams({ status, limit: String(limit) });
  if (cursor) search.set('cursor', cursor);
  return jsonOrThrow<OriginalsPage>(
    await apiFetch(`/api/weddings/${encodeURIComponent(eventId)}/photos/originals?${search.toString()}`),
  );
};

/** Every original's metadata, page by page (signed URLs are fetched lazily, per page). */
async function* originalPages(eventId: string, status: DownloadScope): AsyncGenerator<OriginalFile[]> {
  let cursor: string | null = null;
  do {
    const page = await fetchOriginalsPage(eventId, status, cursor);
    yield page.photos;
    cursor = page.nextCursor;
  } while (cursor);
}

/** Opens one original as a stream. Signed Storage URLs are fetched directly, without the API token. */
const openOriginal = async (file: OriginalFile, signal?: AbortSignal) => {
  const response = await fetch(file.url, { signal });
  if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
  return { name: file.filename, input: response.body, size: file.size, lastModified: new Date() };
};

export type Progress = { done: number; total: number; archive?: number };

type SavePicker = (options: {
  suggestedName: string;
  types?: { description: string; accept: Record<string, string[]> }[];
}) => Promise<{ createWritable: () => Promise<WritableStream<Uint8Array>> }>;

const savePicker = (): SavePicker | null => {
  const candidate = (globalThis as { showSaveFilePicker?: SavePicker }).showSaveFilePicker;
  return typeof candidate === 'function' ? candidate.bind(globalThis) : null;
};

/** `streaming` writes one ZIP straight to disk (Chromium); `batches` is the Safari/Firefox fallback. */
export const downloadMode = (): 'streaming' | 'batches' => (savePicker() ? 'streaming' : 'batches');

const saveBlob = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.rel = 'noopener';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

/**
 * UC-85: builds the ZIP in the browser from paginated signed originals. With the
 * File System Access API the archive is streamed to the chosen file and never held
 * in memory; otherwise archives of at most {@link FALLBACK_BATCH_BYTES} are built
 * and saved one after another (`name-1.zip`, `name-2.zip`, …). Originals are stored
 * without recompression (JPEG/PNG/WebP are already compressed).
 */
export const downloadAllOriginals = async (
  eventId: string,
  status: DownloadScope,
  archiveName: string,
  total: number,
  onProgress: (progress: Progress) => void,
  signal?: AbortSignal,
  batchLimit = FALLBACK_BATCH_BYTES,
): Promise<{ mode: 'streaming' | 'batches'; archives: number }> => {
  let done = 0;
  onProgress({ done, total });
  const picker = savePicker();

  if (picker) {
    const handle = await picker({
      suggestedName: `${archiveName}.zip`,
      types: [{ description: 'ZIP', accept: { 'application/zip': ['.zip'] } }],
    });
    const writable = await handle.createWritable();
    async function* inputs() {
      for await (const page of originalPages(eventId, status)) {
        for (const file of page) {
          yield await openOriginal(file, signal);
          done += 1;
          onProgress({ done, total });
        }
      }
    }
    await makeZip(inputs()).pipeTo(writable, { signal });
    return { mode: 'streaming', archives: 1 };
  }

  let archive = 0;
  let batch: OriginalFile[] = [];
  let batchBytes = 0;
  const flush = async () => {
    if (batch.length === 0) return;
    archive += 1;
    const files = batch;
    batch = [];
    batchBytes = 0;
    async function* inputs() {
      for (const file of files) {
        yield await openOriginal(file, signal);
        done += 1;
        onProgress({ done, total, archive });
      }
    }
    const blob = await new Response(makeZip(inputs())).blob();
    saveBlob(blob, `${archiveName}-${archive}.zip`);
  };
  for await (const page of originalPages(eventId, status)) {
    for (const file of page) {
      if (batch.length > 0 && batchBytes + file.size > batchLimit) await flush();
      batch.push(file);
      batchBytes += file.size;
    }
  }
  await flush();
  return { mode: 'batches', archives: archive };
};

/** UC-85 single download: the signed original URL already asks the browser to save it. */
export const downloadOriginal = async (photoId: string): Promise<void> => {
  const { original } = await jsonOrThrow<{ original: OriginalFile }>(
    await apiFetch(`/api/photos/${encodeURIComponent(photoId)}/original`),
  );
  const anchor = document.createElement('a');
  anchor.href = original.url;
  anchor.download = original.filename;
  anchor.rel = 'noopener';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
};
