import sharp, { type Sharp } from 'sharp';

export type ThumbnailProbe = {
  width: number;
  height: number;
  format: string;
  bytes: number;
};

/**
 * Decompression/pixel ceiling for uploaded originals (SPEC §7.2). sharp refuses
 * larger inputs instead of allocating unbounded memory.
 */
export const MAX_INPUT_PIXELS = 50_000_000;

export type ImageMetadata = {
  format: 'jpeg' | 'png' | 'webp';
  width: number;
  height: number;
  size: number;
};

/** Reads the real format and dimensions; null when sharp cannot decode the bytes. */
export const readImageMetadata = async (buffer: Buffer): Promise<ImageMetadata | null> => {
  try {
    const image = sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS, sequentialRead: true });
    const metadata = await image.metadata();
    const format = metadata.format;
    if (format !== 'jpeg' && format !== 'png' && format !== 'webp') return null;
    if (!metadata.width || !metadata.height) return null;
    return { format, width: metadata.width, height: metadata.height, size: buffer.byteLength };
  } catch {
    return null;
  }
};

export type Derivative = { buffer: Buffer; width: number; height: number };

const derivative = async (pipeline: Sharp, width: number, quality: number): Promise<Derivative> => {
  const { data, info } = await pipeline
    .resize({ width, height: width, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality })
    .toBuffer({ resolveWithObject: true });
  return { buffer: data, width: info.width, height: info.height };
};

/**
 * `web` (long side 1600 px, JPEG q80) and `thumb` (400 px, q75) versions of an
 * original (SPEC §7.2). `rotate()` applies the EXIF orientation first; sharp then
 * writes fresh JPEGs without EXIF/GPS/ICC metadata.
 */
export const makeDerivatives = async (input: Buffer): Promise<{ web: Derivative; thumb: Derivative }> => {
  const base = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, sequentialRead: true }).rotate();
  const [web, thumb] = await Promise.all([derivative(base.clone(), 1600, 80), derivative(base.clone(), 400, 75)]);
  return { web, thumb };
};

/**
 * Runs a real sharp pipeline (create → resize → JPEG encode → metadata decode).
 * The M0 spike calls it from the mounted Hono app inside a production Next.js
 * build, which is what proves the Node runtime runs the native sharp module.
 */
export const makeThumbnailProbe = async (): Promise<ThumbnailProbe> => {
  const source = sharp({
    create: { width: 48, height: 32, channels: 3, background: { r: 200, g: 90, b: 70 } },
  });
  const output = await source.resize(24, 16, { fit: 'cover' }).jpeg({ quality: 72 }).toBuffer();
  const metadata = await sharp(output).metadata();
  return {
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
    format: metadata.format ?? 'unknown',
    bytes: output.byteLength,
  };
};
