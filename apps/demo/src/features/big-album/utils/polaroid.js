export const HAND = "'Caveat', 'Segoe Print', cursive";

export function jitter(str = '', salt = 0) {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return ((h >>> 0) % 2001) / 1000 - 1;
}
