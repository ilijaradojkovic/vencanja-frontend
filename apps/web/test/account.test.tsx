import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PhoneRequiredModal } from '../src/components/PhoneRequiredModal';
import { AccountSettings, type AccountCopy } from '../src/features/settings/AccountSettings';

const copy: AccountCopy = {
  accountTitle: 'Nalog',
  email: 'Email za prijavu',
  emailHint: 'Promena adrese traži potvrdu.',
  changeEmail: 'Promeni email',
  newEmail: 'Nova email adresa',
  awaitingConfirmation: 'Čeka potvrdu: {{email}}',
  emailSent: 'Poslali smo linkove.',
  emailError: 'Adresa nije promenjena.',
  passwordTitle: 'Lozinka',
  currentPassword: 'Trenutna lozinka',
  newPassword: 'Nova lozinka',
  confirmPassword: 'Ponovite novu lozinku',
  changePassword: 'Promeni lozinku',
  setPassword: 'Postavi lozinku',
  setPasswordHint: 'Poslaćemo vam link.',
  passwordChanged: 'Lozinka je promenjena.',
  passwordError: 'Lozinka nije promenjena.',
  currentPasswordError: 'Trenutna lozinka nije ispravna.',
  mismatch: 'Lozinke se ne poklapaju.',
  passwordTooShort: 'Lozinka mora imati bar 8 znakova.',
  phone: 'Telefon',
  phoneWillSave: 'Biće sačuvan kao {{phone}}',
  savePhone: 'Sačuvaj broj',
  phoneSaved: 'Broj telefona je sačuvan.',
  language: 'Jezik',
  saved: 'Sačuvano.',
  retentionNote: 'Brisanje dolazi kasnije.',
};

const profile = {
  id: 'user-1',
  role: 'couple' as const,
  email: 'ana@uspomena.test',
  name: 'Ana i Marko',
  phone: '',
  locale: 'sr' as const,
  active: true,
  onboardedAt: '2026-11-22T10:00:00.000Z',
  providers: ['email'],
};

describe('PhoneRequiredModal (UC-07)', () => {
  it('saves the number and shows the API error instead of closing', async () => {
    const onSave = vi.fn().mockResolvedValueOnce({ ok: false, message: 'Unesite ispravan broj telefona.' });
    render(
      <PhoneRequiredModal
        copy={{
          title: 'Dodajte broj telefona',
          text: 'Broj je obavezan.',
          label: 'Telefon',
          save: 'Sačuvaj broj',
          willSave: 'Biće sačuvan kao {{phone}}',
          logout: 'Odjavi se',
        }}
        onSave={onSave}
        onSignOut={async () => {}}
      />,
    );

    await userEvent.type(screen.getByLabelText(/^Telefon/), '064 123 4567');
    await userEvent.click(screen.getByRole('button', { name: 'Sačuvaj broj' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unesite ispravan broj telefona.');
    expect(onSave).toHaveBeenCalledWith({ phone: '064 123 4567' });
  });
});

describe('AccountSettings (UC-08, UC-82, UC-83)', () => {
  it('saves a new phone number through PATCH /auth/me', async () => {
    const onPatchProfile = vi.fn().mockResolvedValue({ ok: true, profile: { ...profile, phone: '+381641234567' } });
    render(<AccountSettings profile={profile} copy={copy} actions={{ onPatchProfile }} />);

    await userEvent.type(screen.getByLabelText(/^Telefon/), '064 123 4567');
    await userEvent.click(screen.getByRole('button', { name: 'Sačuvaj broj' }));

    expect(onPatchProfile).toHaveBeenCalledWith({ phone: '064 123 4567' });
    expect(await screen.findByText('Broj telefona je sačuvan.')).toBeInTheDocument();
  });

  it('changes the email and shows the address awaiting confirmation', async () => {
    const onChangeEmail = vi.fn().mockResolvedValue({ ok: true, pending: 'novo@uspomena.test' });
    render(<AccountSettings profile={profile} copy={copy} actions={{ onChangeEmail }} />);

    await userEvent.type(screen.getByLabelText(/^Nova email adresa/), 'novo@uspomena.test');
    await userEvent.click(screen.getByRole('button', { name: 'Promeni email' }));

    expect(onChangeEmail).toHaveBeenCalledWith('novo@uspomena.test');
    expect(await screen.findByText('Čeka potvrdu: novo@uspomena.test')).toBeInTheDocument();
    expect(screen.getByText('Poslali smo linkove.')).toBeInTheDocument();
  });

  it('validates the new password and reports a wrong current password', async () => {
    const onChangePassword = vi.fn().mockResolvedValue({ ok: false, wrongCurrent: true });
    render(<AccountSettings profile={profile} copy={copy} actions={{ onChangePassword }} />);

    await userEvent.type(screen.getByLabelText('Trenutna lozinka'), 'pogresna');
    await userEvent.type(screen.getByLabelText('Nova lozinka'), 'kratka');
    await userEvent.type(screen.getByLabelText('Ponovite novu lozinku'), 'kratka');
    await userEvent.click(screen.getByRole('button', { name: 'Promeni lozinku' }));
    expect(screen.getByRole('alert')).toHaveTextContent(copy.passwordTooShort);
    expect(onChangePassword).not.toHaveBeenCalled();

    await userEvent.clear(screen.getByLabelText('Nova lozinka'));
    await userEvent.type(screen.getByLabelText('Nova lozinka'), 'lozinka-123');
    await userEvent.clear(screen.getByLabelText('Ponovite novu lozinku'));
    await userEvent.type(screen.getByLabelText('Ponovite novu lozinku'), 'lozinka-123');
    await userEvent.click(screen.getByRole('button', { name: 'Promeni lozinku' }));

    await waitFor(() => expect(onChangePassword).toHaveBeenCalledWith('pogresna', 'lozinka-123'));
    expect(await screen.findByRole('alert')).toHaveTextContent(copy.currentPasswordError);
  });

  it('offers "Set password" to a Google-only account (UC-83)', async () => {
    const onSetPasswordMail = vi.fn().mockResolvedValue({ ok: true });
    render(
      <AccountSettings profile={{ ...profile, providers: ['google'] }} copy={copy} actions={{ onSetPasswordMail }} />,
    );

    expect(screen.queryByLabelText('Trenutna lozinka')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Postavi lozinku' }));
    expect(onSetPasswordMail).toHaveBeenCalledWith(profile.email);
  });
});
