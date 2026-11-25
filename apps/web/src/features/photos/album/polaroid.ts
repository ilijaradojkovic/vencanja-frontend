export const HAND = "'Caveat', 'Segoe Print', cursive";

/** Deterministic pseudo-random value in [-1, 1] per photo, for stable tilt/offsets. */
export function jitter(value = '', salt = 0): number {
  let hash = 2166136261 ^ salt;
  for (let index = 0; index < value.length; index++) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return ((hash >>> 0) % 2001) / 1000 - 1;
}

export type AlbumPhoto = {
  id: string;
  guestId: string | null;
  senderName: string;
  message: string;
  url: string | null;
  thumbUrl: string | null;
  width: number | null;
  height: number | null;
};
