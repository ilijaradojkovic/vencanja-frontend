import sharp from 'sharp';

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
