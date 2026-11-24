'use client';

type Props = {
  src: string | null;
  alt: string;
  width: number | null;
  height: number | null;
  /** Called when the image fails to load, i.e. its signed URL has likely expired. */
  onExpired: () => void;
  className?: string;
};

/**
 * Plain `<img>` for a signed photo URL (SPEC §7.3, not `next/image`): lazy,
 * async decoding and intrinsic size to avoid layout shift. A load failure asks
 * the owning list to re-sign its URLs.
 */
export function SignedPhoto({ src, alt, width, height, onExpired, className }: Props) {
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- signed URLs change hourly (SPEC §7.3)
    <img
      src={src}
      alt={alt}
      width={width ?? undefined}
      height={height ?? undefined}
      loading="lazy"
      decoding="async"
      className={className}
      onError={onExpired}
    />
  );
}
