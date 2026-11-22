'use client';

import { useEffect, useState, type CSSProperties } from 'react';

export type ResendCopy = {
  resend: string;
  resent: string;
  wait: string;
};

const COOLDOWN_SECONDS = 60;

/**
 * UC-78 "Pošalji ponovo": the button is re-enabled 60 seconds after a send, and
 * the confirmation email is resent through Supabase Auth.
 */
export function ResendButton({
  email,
  copy,
  onResend,
  initialSeconds = COOLDOWN_SECONDS,
}: {
  email: string;
  copy: ResendCopy;
  onResend?: (email: string) => Promise<{ ok: boolean; message?: string }>;
  initialSeconds?: number;
}) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  const submit = async () => {
    if (!onResend || seconds > 0) return;
    setStatus('sending');
    const result = await onResend(email);
    if (result.ok) {
      setStatus('sent');
      setSeconds(COOLDOWN_SECONDS);
    } else {
      setStatus('error');
    }
  };

  return (
    <div className="stack" style={{ '--gap': '6px' } as CSSProperties}>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={submit}
        disabled={seconds > 0 || status === 'sending'}
      >
        {copy.resend}
      </button>
      <span className="xs muted" role="status">
        {status === 'sent' ? copy.resent.replace('{{email}}', email) : null}
        {status !== 'sent' && seconds > 0 ? copy.wait.replace('{{seconds}}', String(seconds)) : null}
      </span>
    </div>
  );
}
