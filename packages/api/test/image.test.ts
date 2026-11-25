import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { makeDerivatives, readImageMetadata } from '../src/services/image.ts';

const source = async (options: {
  width: number;
  height: number;
  orientation?: number;
  exif?: boolean;
}): Promise<Buffer> => {
  let pipeline = sharp({
    create: { width: options.width, height: options.height, channels: 3, background: { r: 200, g: 120, b: 80 } },
  }).jpeg({ quality: 90 });
  if (options.exif) {
    pipeline = pipeline.withMetadata({ orientation: options.orientation ?? 1 }).withExif({
      IFD0: { Copyright: 'Uspomena test' },
      GPS: { GPSLatitudeRef: 'N', GPSLatitude: '44/1 48/1 0/1' },
    });
  }
  return pipeline.toBuffer();
};

describe('sharp derivatives (SPEC §7.2)', () => {
  it('creates 1600 px web and 400 px thumb JPEGs without EXIF/GPS metadata', async () => {
    const input = await source({ width: 2000, height: 1200, exif: true });
    const before = await sharp(input).metadata();
    expect(before.exif).toBeDefined();

    const { web, thumb } = await makeDerivatives(input);
    expect(web).toMatchObject({ width: 1600, height: 960 });
    expect(thumb).toMatchObject({ width: 400, height: 240 });

    for (const derivative of [web, thumb]) {
      const metadata = await sharp(derivative.buffer).metadata();
      expect(metadata.format).toBe('jpeg');
      expect(metadata.exif).toBeUndefined();
      expect(metadata.icc).toBeUndefined();
      expect(metadata.orientation).toBeUndefined();
      expect(metadata.width).toBe(derivative.width);
      expect(metadata.height).toBe(derivative.height);
    }
  });

  it('applies the EXIF orientation before resizing', async () => {
    const input = await source({ width: 240, height: 180, orientation: 6, exif: true });
    const { web, thumb } = await makeDerivatives(input);
    // Rotated to 180×240; long side 1600/400 does not enlarge small images.
    expect(web).toMatchObject({ width: 180, height: 240 });
    expect(thumb).toMatchObject({ width: 180, height: 240 });
  });

  it('reports the real format and rejects unreadable bytes', async () => {
    const input = await source({ width: 100, height: 80 });
    expect(await readImageMetadata(input)).toMatchObject({ format: 'jpeg', width: 100, height: 80 });
    expect(await readImageMetadata(Buffer.from('not an image'))).toBeNull();
    await expect(makeDerivatives(Buffer.from('not an image'))).rejects.toBeTruthy();
  });
});
