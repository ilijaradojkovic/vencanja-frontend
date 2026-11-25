import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { OnboardingWizard, type OnboardingCopy } from '../src/components/auth/OnboardingWizard';

const copy: OnboardingCopy = {
  title: 'Dobro došli',
  intro: 'Napravimo vašu pozivnicu u nekoliko koraka.',
  step: 'Korak {{current}} od {{total}}',
  typeTitle: 'Šta slavite?',
  wedding: 'Venčanje',
  celebration: 'Proslava',
  namesTitle: 'Imena i datum',
  contactTitle: 'Kontakt',
  phoneHint: 'Obavezan. Jedan broj za ceo nalog.',
  back: 'Nazad',
  next: 'Dalje',
  finish: 'Završi',
  logout: 'Odjavi se',
  error: 'Proverite unete podatke.',
  fields: {
    partner1: 'Mlada',
    partner2: 'Mladoženja',
    celebrant: 'Slavljenik',
    occasion: 'Naziv proslave',
    occasionPlaceholder: 'npr. 18. rođendan',
    weddingDate: 'Datum venčanja',
    celebrationDate: 'Datum proslave',
    phone: 'Telefon',
    city: 'Grad',
    cityPlaceholder: 'npr. Beograd',
  },
};

const profile = {
  ok: true as const,
  profile: {
    id: 'user-1',
    role: 'couple' as const,
    email: 'ana@uspomena.test',
    name: 'Ana',
    phone: '',
    locale: 'sr' as const,
    active: true,
    onboardedAt: null,
  },
};

describe('OnboardingWizard (UC-81)', () => {
  it('walks the three steps, keeps the data on "Back" and submits the event', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: true });
    const onDone = vi.fn();
    render(
      <OnboardingWizard
        copy={copy}
        onLoadProfile={async () => profile}
        onSubmit={onSubmit}
        onDone={onDone}
        onSignOut={async () => {}}
      />,
    );

    expect(await screen.findByText('Korak 1 od 3')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Proslava' }));
    await userEvent.click(screen.getByRole('button', { name: 'Dalje' }));

    await userEvent.type(screen.getByLabelText('Slavljenik'), 'Luka');
    await userEvent.type(screen.getByLabelText('Naziv proslave'), '18. rođendan');
    await userEvent.type(screen.getByLabelText('Datum proslave'), '2027-05-20');
    await userEvent.click(screen.getByRole('button', { name: 'Nazad' }));
    expect(screen.getByRole('button', { name: 'Proslava' })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'Dalje' }));
    expect(screen.getByLabelText('Slavljenik')).toHaveValue('Luka');
    await userEvent.click(screen.getByRole('button', { name: 'Dalje' }));

    await userEvent.type(screen.getByLabelText(/^Telefon/), '064 123 4567');
    await userEvent.type(screen.getByLabelText('Grad'), 'Beograd');
    await userEvent.click(screen.getByRole('button', { name: 'Završi' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      {
        type: 'celebration',
        partner1: 'Luka',
        partner2: '',
        occasion: '18. rođendan',
        date: '2027-05-20',
        phone: '064 123 4567',
        city: 'Beograd',
      },
      profile.profile,
    );
    expect(onDone).toHaveBeenCalledWith('/app');
  });

  it('shows the localized API message when the event already exists', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ ok: false, message: 'Radnja nije moguća u trenutnom stanju.' });
    render(
      <OnboardingWizard
        copy={copy}
        onLoadProfile={async () => profile}
        onSubmit={onSubmit}
        onDone={() => {}}
        onSignOut={async () => {}}
      />,
    );

    expect(await screen.findByText('Korak 1 od 3')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Dalje' }));
    await userEvent.type(screen.getByLabelText('Mlada'), 'Ana');
    await userEvent.type(screen.getByLabelText('Mladoženja'), 'Marko');
    await userEvent.type(screen.getByLabelText('Datum venčanja'), '2027-06-12');
    await userEvent.click(screen.getByRole('button', { name: 'Dalje' }));
    await userEvent.type(screen.getByLabelText(/^Telefon/), '064 123 4567');
    await userEvent.click(screen.getByRole('button', { name: 'Završi' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Radnja nije moguća u trenutnom stanju.');
  });
});
