'use client';

import { useRouter } from 'next/navigation';

import { signOut } from '@/lib/auth/actions';

/** Sign-out through the Supabase client (cookies cleared) per UC-09. */
export function SignOutButton({ label, onSignOut = signOut }: { label: string; onSignOut?: () => Promise<void> }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="btn btn-secondary btn-sm"
      onClick={async () => {
        try {
          await onSignOut();
        } finally {
          // Navigation happens even when the auth call fails; the local session is
          // cleared best-effort so a stale token cannot keep the user in.
          router.push('/login');
          router.refresh();
        }
      }}
    >
      {label}
    </button>
  );
}
