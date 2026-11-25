import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SignupForm, type SignupCopy } from '../src/components/auth/SignupForm';

const copy: SignupCopy = {
  email: 'Email',
  password: 'Lozinka',
  passwordHint: 'Najmanje 8 znakova.',
  submit: 'Napravi nalog',
  passwordTooShort: 'Lozinka mora imati bar 8 znakova.',
  invalidEmail: 'Unesite ispravan email.',
  termsRequired: 'Prihvatite uslove korišćenja i politiku privatnosti.',
  termsBefore: 'Prihvatam',
  termsLink: 'uslove korišćenja',
  termsJoin: 'i',
  privacyLink: 'politiku privatnosti',
  error: 'Nalog nije napravljen. Pokušajte ponovo.',
};

const fill = async (email: string, password: string) => {
  await userEvent.type(screen.getByLabelText(/^Email/), email);
  await userEvent.type(screen.getByLabelText(/^Lozinka/), password);
};

describe('SignupForm (UC-77)', () => {
  it('validates the email, the 8-character password and the legal acceptance', async () => {
    const onSignUp = vi.fn();
    render(<SignupForm copy={copy} locale="sr" onSignUp={onSignUp} />);

    await fill('nije-email', 'lozinka-123');
    await userEvent.click(screen.getByRole('button', { name: 'Napravi nalog' }));
    expect(screen.getByRole('alert')).toHaveTextContent(copy.invalidEmail);

    await userEvent.clear(screen.getByLabelText(/^Email/));
    await userEvent.clear(screen.getByLabelText(/^Lozinka/));
    await fill('ana@uspomena.test', 'kratka');
    await userEvent.click(screen.getByRole('button', { name: 'Napravi nalog' }));
    expect(screen.getByRole('alert')).toHaveTextContent(copy.passwordTooShort);

    await userEvent.clear(screen.getByLabelText(/^Lozinka/));
    await fill('ana@uspomena.test', 'lozinka-123');
    await userEvent.click(screen.getByRole('button', { name: 'Napravi nalog' }));
    expect(screen.getByRole('alert')).toHaveTextContent(copy.termsRequired);
    expect(onSignUp).not.toHaveBeenCalled();
  });

  it('signs up with the locale and accepted legal versions, then shows the check-email screen', async () => {
    const onSignUp = vi.fn().mockResolvedValue({ ok: true });
    const onCreated = vi.fn();
    render(<SignupForm copy={copy} locale="en" onSignUp={onSignUp} onCreated={onCreated} />);

    await fill('ana@uspomena.test', 'lozinka-123');
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Napravi nalog' }));

    expect(onSignUp).toHaveBeenCalledWith({ email: 'ana@uspomena.test', password: 'lozinka-123', locale: 'en' });
    expect(onCreated).toHaveBeenCalledWith('ana@uspomena.test');
  });

  it('shows an error when the account could not be created', async () => {
    const onSignUp = vi.fn().mockResolvedValue({ ok: false, message: 'rate limited' });
    render(<SignupForm copy={copy} locale="sr" onSignUp={onSignUp} />);

    await fill('ana@uspomena.test', 'lozinka-123');
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Napravi nalog' }));

    expect(screen.getByRole('alert')).toHaveTextContent(copy.error);
  });
});
