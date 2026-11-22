import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';

/**
 * The prototype's sign-in layout (apps/demo `login.page.jsx`): a centered card on
 * the dark green background with the brand link. Shared by every account page so
 * the ported screens look the same.
 */
export function AuthShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const style = {
    width: wide ? 'min(560px, 100%)' : 'min(420px, 100%)',
    '--gap': '18px',
    padding: 32,
  } as CSSProperties;
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 20,
        background: 'var(--green-dark)',
      }}
    >
      <div className="card stack" style={style}>
        {children}
      </div>
    </div>
  );
}

export function BrandRow({ children }: { children?: ReactNode }) {
  return (
    <div className="row between">
      <Link href="/" className="brand" style={{ color: 'var(--ink)' }}>
        Uspomena
      </Link>
      {children}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint ? <span className="xs muted">{hint}</span> : null}
    </label>
  );
}

export function FormError({ children }: { children: ReactNode }) {
  return (
    <div className="form-error" role="alert">
      {children}
    </div>
  );
}
