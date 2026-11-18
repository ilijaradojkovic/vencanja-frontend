/** Pomoćno za polaroid izgled velikog albuma. */

export const HAND = "'Caveat', 'Segoe Print', cursive";

/** deterministički "slučajan" broj u [-1, 1] iz stringa – isti album uvek izgleda isto */
export function jitter(str = '', salt = 0) {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return ((h >>> 0) % 2001) / 1000 - 1;
}
