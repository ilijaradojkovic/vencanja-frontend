import { env } from '../env.ts';

export const PHOTOS_BUCKET = 'photos';

/**
 * Minimal Storage client for the API (uploads, completion, deletion). Only server
 * code uses the service-role key; guests PUT directly to a signed URL.
 */
const headers = (): Record<string, string> => ({
  apikey: env.supabaseServiceKey(),
  authorization: `Bearer ${env.supabaseServiceKey()}`,
});

const objectUrl = (path: string, action = 'object'): string =>
  `${env.supabaseUrl()}/storage/v1/${action}/${PHOTOS_BUCKET}/${path}`;

/** A signed upload URL valid for two hours (SPEC §6.3). */
export const createSignedUploadUrl = async (path: string): Promise<{ uploadUrl: string; token: string }> => {
  const response = await fetch(objectUrl(path, 'object/upload/sign'), {
    method: 'POST',
    headers: { ...headers(), 'content-type': 'application/json' },
    body: JSON.stringify({ expiresIn: 7200 }),
  });
  if (!response.ok) {
    throw new Error(`Storage could not sign an upload (${response.status}): ${await response.text()}`);
  }
  const body = (await response.json()) as { url: string; token: string };
  return { uploadUrl: `${env.supabaseUrl()}/storage/v1${body.url}`, token: body.token };
};

/** `null` when the object does not exist. */
export const objectInfo = async (path: string): Promise<{ size: number } | null> => {
  const response = await fetch(objectUrl(path), { method: 'HEAD', headers: headers() });
  if (response.status === 404 || response.status === 400) return null;
  if (!response.ok) throw new Error(`Storage object lookup failed (${response.status}).`);
  return { size: Number(response.headers.get('content-length') ?? 0) };
};

export const downloadObject = async (path: string): Promise<Buffer | null> => {
  const response = await fetch(objectUrl(path), { headers: headers() });
  if (response.status === 404 || response.status === 400) return null;
  if (!response.ok) throw new Error(`Storage download failed (${response.status}).`);
  return Buffer.from(await response.arrayBuffer());
};

/** Deletes the given object paths in batches (Storage caps a delete request). */
export const deleteObjects = async (paths: string[]): Promise<void> => {
  const unique = [...new Set(paths.filter(Boolean))];
  const batchSize = 100;
  for (let index = 0; index < unique.length; index += batchSize) {
    const prefixes = unique.slice(index, index + batchSize);
    const response = await fetch(`${env.supabaseUrl()}/storage/v1/object/${PHOTOS_BUCKET}`, {
      method: 'DELETE',
      headers: { ...headers(), 'content-type': 'application/json' },
      body: JSON.stringify({ prefixes }),
    });
    if (!response.ok) {
      throw new Error(`Storage delete failed (${response.status}): ${await response.text()}`);
    }
  }
};
