'use client';

import { apiFetch } from '@/lib/diagnostics/api';

import { ApiLoadError, type Photo } from './signed-photos';

const send = async <T>(path: string, method: string, body?: unknown): Promise<T> => {
  const response = await apiFetch(path, {
    method,
    ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  });
  const json = (await response.json().catch(() => ({}))) as T & { message?: string; code?: string };
  if (!response.ok) throw new ApiLoadError(json.message ?? `HTTP ${response.status}`, response.status, json.code);
  return json;
};

/** UC-36: approve, hide or return a photo to pending. */
export const setPhotoStatus = async (id: string, status: Photo['status']): Promise<Photo> =>
  (await send<{ photo: Photo }>(`/api/photos/${encodeURIComponent(id)}`, 'PATCH', { status })).photo;

/** UC-37: bulk status for the organizer's own event. */
export const bulkPhotoStatus = async (eventId: string, ids: string[], status: Photo['status']): Promise<Photo[]> =>
  (
    await send<{ photos: Photo[] }>(`/api/weddings/${encodeURIComponent(eventId)}/photos/bulk-status`, 'POST', {
      ids,
      status,
    })
  ).photos;

/** UC-39: deletes the photo and its three stored files. */
export const deletePhoto = async (id: string): Promise<void> => {
  await send<{ id: string }>(`/api/photos/${encodeURIComponent(id)}`, 'DELETE');
};
