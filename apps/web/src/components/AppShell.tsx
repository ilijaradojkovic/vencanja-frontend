'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { PhoneRequiredModal, type PhoneRequiredCopy } from '@/components/PhoneRequiredModal';
import { SignOutButton } from '@/components/auth/SignOutButton';

/**
 * Minimal organizer shell for M2: brand, two nav links and sign-out, plus the
 * UC-07 phone gate. The prototype's sidebar is ported with the dashboard in M3.
 */
export function AppShell({
  children,
  nav,
  hasPhone,
  logoutLabel,
  phoneCopy,
}: {
  children: ReactNode;
  nav: { dashboard: string; settings: string };
  hasPhone: boolean;
  logoutLabel: string;
  phoneCopy: PhoneRequiredCopy;
}) {
  const pathname = usePathname();
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header className="card" style={{ borderRadius: 0, borderLeft: 0, borderRight: 0, padding: '14px 20px' }}>
        <div className="row between" style={{ maxWidth: 1040, margin: '0 auto' }}>
          <div className="row" style={{ '--gap': '18px' } as React.CSSProperties}>
            <Link href="/app" className="brand" style={{ color: 'var(--ink)' }}>
              Uspomena
            </Link>
            <nav className="row" style={{ '--gap': '10px' } as React.CSSProperties}>
              <Link
                href="/app"
                className="small"
                aria-current={pathname === '/app' ? 'page' : undefined}
                style={{ fontWeight: pathname === '/app' ? 600 : 400 }}
              >
                {nav.dashboard}
              </Link>
              <Link
                href="/app/podesavanja"
                className="small"
                aria-current={pathname === '/app/podesavanja' ? 'page' : undefined}
                style={{ fontWeight: pathname === '/app/podesavanja' ? 600 : 400 }}
              >
                {nav.settings}
              </Link>
            </nav>
          </div>
          <SignOutButton label={logoutLabel} />
        </div>
      </header>
      <main style={{ maxWidth: 1040, margin: '0 auto', padding: 24 }}>{children}</main>
      {hasPhone ? null : <PhoneRequiredModal copy={phoneCopy} />}
    </div>
  );
}
