import sharp from 'sharp';

export type ThumbnailProbe = {
  width: number;
  height: number;
  format: string;
  bytes: number;
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
