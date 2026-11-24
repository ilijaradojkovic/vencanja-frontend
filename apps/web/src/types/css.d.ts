import 'react';

declare module 'react' {
  // The prototype uses CSS custom properties in inline styles (`--gap`, `--accent`…).
  interface CSSProperties {
    [key: `--${string}`]: string | number | undefined;
  }
}
