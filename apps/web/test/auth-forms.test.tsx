import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CheckEmailPanel } from '../src/components/auth/CheckEmailPanel';
import { ForgotPasswordForm } from '../src/components/auth/ForgotPasswordForm';
import { LoginForm, type LoginCopy } from '../src/components/auth/LoginForm';
import { NewPasswordForm, type NewPasswordCopy } from '../src/components/auth/NewPasswordForm';

const loginCopy: LoginCopy = {
  email: 'Email',
  password: 'Lozinka',
  submit: 'Prijavi se',
  error: 'Pogrešan email ili lozinka.',
  rateLimited: 'Previše pokušaja, pokušajte ponovo za koji trenutak.',
  google: 'Nastavi sa Google nalogom',
  unverified: 'Potvrdite email pre prijave.',
  resend: 'Pošalji ponovo',
  resent: 'Poslali smo novi link na {{email}}.',
  wait: 'Novi link možete tražiti za {{seconds}} s.',
};

const profile = {
  id: 'user-1',
  role: 'couple' as const,
  email: 'ana@uspomena.test',
  name: 'Ana',
  phone: '',
  locale: 'sr' as const,
  active: true,
  onboardedAt: null,
};

const newPasswordCopy: NewPasswordCopy = {
  text: 'Unesite novu lozinku dva puta.',
  newPassword: 'Nova lozinka',
  passwordConfirm: 'Ponovite lozinku',
  submit: 'Sačuvaj novu lozinku',
  mismatch: 'Lozinke se ne poklapaju.',
  passwordTooShort: 'Lozinka mora imati bar 8 znakova.',
  expired: 'Link je istekao ili je već iskorišćen.',
  newLink: 'Zatražite novi link',
  error: 'Lozinka nije promenjena. Pokušajte ponovo.',
};

describe('LoginForm (UC-05, UC-78)', () => {
  it('routes a signed-in organizer without onboarding to the wizard', async () => {
    const onSignIn = vi.fn().mockResolvedValue({ ok: true, profile });
    const onAuthenticated = vi.fn();
    render(<LoginForm copy={loginCopy} onSignIn={onSignIn} onAuthenticated={onAuthenticated} />);

    await userEvent.type(screen.getByLabelText(/^Email/), 'ana@uspomena.test');
    await userEvent.type(screen.getByLabelText(/^Lozinka/), 'lozinka-123');
    await userEvent.click(screen.getByRole('button', { name: 'Prijavi se' }));

    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledWith('/onboarding'));
  });

  it('shows the wrong-credentials message and keeps the form', async () => {
    const onSignIn = vi.fn().mockResolvedValue({ ok: false, message: 'Invalid login credentials' });
    render(<LoginForm copy={loginCopy} onSignIn={onSignIn} onAuthenticated={() => {}} />);

    await userEvent.type(screen.getByLabelText(/^Email/), 'ana@uspomena.test');
    await userEvent.type(screen.getByLabelText(/^Lozinka/), 'pogresna');
    await userEvent.click(screen.getByRole('button', { name: 'Prijavi se' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(loginCopy.error);
  });

  it('offers the resend action for an unconfirmed email (UC-78)', async () => {
    const onSignIn = vi.fn().mockResolvedValue({ ok: false, unverified: true, message: 'Email not confirmed' });
    const onResend = vi.fn().mockResolvedValue({ ok: true });
    render(<LoginForm copy={loginCopy} onSignIn={onSignIn} onResend={onResend} onAuthenticated={() => {}} />);

    await userEvent.type(screen.getByLabelText(/^Email/), 'ana@uspomena.test');
    await userEvent.type(screen.getByLabelText(/^Lozinka/), 'lozinka-123');
    await userEvent.click(screen.getByRole('button', { name: 'Prijavi se' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(loginCopy.unverified);
    await userEvent.click(screen.getByRole('button', { name: 'Pošalji ponovo' }));
    expect(onResend).toHaveBeenCalledWith('ana@uspomena.test');
    expect(await screen.findByText('Poslali smo novi link na ana@uspomena.test.')).toBeInTheDocument();
  });
});

describe('ForgotPasswordForm (UC-80)', () => {
  it('always shows the same sent message', async () => {
    const onRequest = vi.fn().mockResolvedValue({ ok: true });
    render(
      <ForgotPasswordForm
        copy={{
          text: 'Unesite email.',
          submit: 'Pošalji link',
          sent: 'Ako nalog postoji, poslali smo link na {{email}}.',
          email: 'Email',
        }}
        onRequest={onRequest}
      />,
    );

    await userEvent.type(screen.getByLabelText(/^Email/), 'nepostojeci@uspomena.test');
    await userEvent.click(screen.getByRole('button', { name: 'Pošalji link' }));

    expect(await screen.findByTestId('reset-sent')).toHaveTextContent(
      'Ako nalog postoji, poslali smo link na nepostojeci@uspomena.test.',
    );
  });
});

describe('NewPasswordForm (UC-80, UC-83)', () => {
  it('rejects a short or mismatched password without calling the API', async () => {
    const onSubmit = vi.fn();
    render(<NewPasswordForm copy={newPasswordCopy} hasSession onSubmit={onSubmit} onDone={() => {}} />);

    await userEvent.type(screen.getByLabelText(/^Nova lozinka/), 'kratka');
    await userEvent.type(screen.getByLabelText(/^Ponovite lozinku/), 'kratka');
    await userEvent.click(screen.getByRole('button', { name: 'Sačuvaj novu lozinku' }));
    expect(screen.getByRole('alert')).toHaveTextContent(newPasswordCopy.passwordTooShort);

    await userEvent.clear(screen.getByLabelText(/^Nova lozinka/));
    await userEvent.type(screen.getByLabelText(/^Nova lozinka/), 'lozinka-123');
    await userEvent.click(screen.getByRole('button', { name: 'Sačuvaj novu lozinku' }));
    expect(screen.getByRole('alert')).toHaveTextContent(newPasswordCopy.mismatch);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('saves the new password and continues to the app', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: true });
    const onDone = vi.fn();
    render(<NewPasswordForm copy={newPasswordCopy} hasSession onSubmit={onSubmit} onDone={onDone} />);

    await userEvent.type(screen.getByLabelText(/^Nova lozinka/), 'lozinka-123');
    await userEvent.type(screen.getByLabelText(/^Ponovite lozinku/), 'lozinka-123');
    await userEvent.click(screen.getByRole('button', { name: 'Sačuvaj novu lozinku' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('lozinka-123'));
    expect(onDone).toHaveBeenCalledWith('/app');
  });

  it('asks for a new link when the session is gone', () => {
    render(<NewPasswordForm copy={newPasswordCopy} hasSession={false} onSubmit={vi.fn()} onDone={() => {}} />);
    expect(screen.getByRole('alert')).toHaveTextContent(newPasswordCopy.expired);
    expect(screen.getByRole('link', { name: newPasswordCopy.newLink })).toHaveAttribute(
      'href',
      '/zaboravljena-lozinka',
    );
  });
});

describe('CheckEmailPanel (UC-77, UC-78)', () => {
  const copy = {
    text: 'Poslali smo link za potvrdu na {{email}}.',
    hint: 'Proverite i spam folder.',
    missingEmail: 'Unesite email.',
    resend: 'Pošalji ponovo',
    resent: 'Poslali smo novi link na {{email}}.',
    wait: 'Novi link možete tražiti za {{seconds}} s.',
  };

  it('shows the address and the 60-second resend countdown', () => {
    render(<CheckEmailPanel email="ana@uspomena.test" copy={copy} />);

    expect(screen.getByText('Poslali smo link za potvrdu na ana@uspomena.test.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pošalji ponovo' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Novi link možete tražiti za 60 s.');
  });
});
