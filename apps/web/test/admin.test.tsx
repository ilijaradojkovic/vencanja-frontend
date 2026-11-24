import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppShell } from '../src/components/AppShell';
import { AccountsPage, type AdminCopy } from '../src/features/admin/AccountsPage';
import { apiFetch } from '../src/lib/diagnostics/api';
import srAuth from '../locales/sr/auth.json';

vi.mock('../src/lib/diagnostics/api', () => ({ apiFetch: vi.fn() }));

const srCopy = srAuth as unknown as { admin: AdminCopy; common: { close: string; cancel: string } };
const adminCopy: AdminCopy = { ...srCopy.admin, common: srCopy.common };
const mockedFetch = vi.mocked(apiFetch);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const account = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'acc-1',
  email: 'ana@uspomena.test',
  name: 'Ana i Marko',
  phone: '+381641234567',
  locale: 'sr',
  active: true,
  onboarded: true,
  providers: ['email'],
  lastLoginAt: null,
  createdAt: '2026-11-22T10:00:00.000Z',
  wedding: {
    id: 'wed-1',
    type: 'wedding',
    occasion: '',
    slug: 'ana-i-marko',
    partner1: 'Ana',
    partner2: 'Marko',
    date: '2027-06-12',
    city: 'Beograd',
    guestCount: 12,
    photoCount: 4,
    storageUsedBytes: 1000,
    storageLimitBytes: 50000000,
  },
  ...overrides,
});

const celebration = account({
  id: 'acc-2',
  email: 'luka@uspomena.test',
  name: 'Luka · 18. rođendan',
  active: false,
  wedding: {
    ...account().wedding,
    id: 'wed-2',
    type: 'celebration',
    occasion: '18. rođendan',
    slug: 'luka-18-rodjendan',
    partner1: 'Luka',
    partner2: '',
    guestCount: 3,
    photoCount: 1,
  },
});

beforeEach(() => {
  mockedFetch.mockReset();
});

describe('AccountsPage (UC-71 – UC-76)', () => {
  it('lists, searches and filters accounts, including accounts without an event', async () => {
    mockedFetch.mockResolvedValueOnce(
      json({
        accounts: [
          account(),
          celebration,
          account({ id: 'acc-3', wedding: null, email: 'novi@uspomena.test', onboarded: false }),
        ],
      }),
    );
    render(<AccountsPage copy={adminCopy} appUrl="http://localhost:3000" />);

    expect(await screen.findByText('Ana & Marko')).toBeInTheDocument();
    expect(screen.getByText('18. rođendan · /luka-18-rodjendan')).toBeInTheDocument();
    expect(screen.getByText('novi@uspomena.test')).toBeInTheDocument();
    expect(screen.getAllByText('Gosti: 12 · Slike: 4').length).toBeGreaterThan(0);

    await userEvent.type(screen.getByPlaceholderText(adminCopy.searchPlaceholder), 'luka');
    expect(screen.queryByText('Ana & Marko')).not.toBeInTheDocument();
    expect(screen.getByText('Luka · 18. rođendan')).toBeInTheDocument();

    await userEvent.clear(screen.getByPlaceholderText(adminCopy.searchPlaceholder));
    await userEvent.click(screen.getByRole('button', { name: /Deaktivirani/ }));
    expect(screen.queryByText('Ana & Marko')).not.toBeInTheDocument();
    expect(screen.getByText('Luka · 18. rođendan')).toBeInTheDocument();
  });

  it('creates an account and shows the one-time credentials', async () => {
    mockedFetch
      .mockResolvedValueOnce(json({ accounts: [] }))
      .mockResolvedValueOnce(json({ account: account(), password: 'generisan12' }, 201))
      .mockResolvedValueOnce(json({ accounts: [account()] }));
    render(<AccountsPage copy={adminCopy} appUrl="http://localhost:3000" />);

    await screen.findByText(adminCopy.empty);
    await userEvent.click(screen.getByRole('button', { name: adminCopy.newAccount }));
    const form = screen.getByRole('dialog');
    await userEvent.type(within(form).getByLabelText(adminCopy.fields.partner1), 'Ana');
    await userEvent.type(within(form).getByLabelText(adminCopy.fields.partner2), 'Marko');
    await userEvent.type(within(form).getByLabelText(adminCopy.fields.date), '2027-06-12');
    await userEvent.type(within(form).getByLabelText(/^Email za prijavu/), 'ana@uspomena.test');
    await userEvent.type(within(form).getByLabelText(/^Telefon/), '064 123 4567');
    await userEvent.click(within(form).getByRole('button', { name: adminCopy.modal.create }));

    await waitFor(() => expect(mockedFetch).toHaveBeenCalledTimes(3));
    const [url, init] = mockedFetch.mock.calls[1] as [string, RequestInit];
    expect(url).toBe('/api/admin/accounts');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toMatchObject({
      type: 'wedding',
      partner1: 'Ana',
      partner2: 'Marko',
      date: '2027-06-12',
      email: 'ana@uspomena.test',
      phone: '064 123 4567',
    });

    expect(await screen.findByText('generisan12')).toBeInTheDocument();
    expect(screen.getByText(adminCopy.credentials.createdTitle)).toBeInTheDocument();
  });

  it('resets a password, deactivates and deletes after confirmation', async () => {
    mockedFetch
      .mockResolvedValueOnce(json({ accounts: [account()] }))
      .mockResolvedValueOnce(json({ password: 'novaLozinka1' }))
      .mockResolvedValueOnce(json({ accounts: [account()] }))
      .mockResolvedValueOnce(json({ account: account({ active: false }) }))
      .mockResolvedValueOnce(json({ accounts: [account({ active: false })] }))
      .mockResolvedValueOnce(json({ ok: true }))
      .mockResolvedValueOnce(json({ accounts: [] }));
    render(<AccountsPage copy={adminCopy} appUrl="http://localhost:3000" />);

    await screen.findByText('Ana & Marko');
    await userEvent.click(screen.getByRole('button', { name: adminCopy.actions.resetPassword }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: adminCopy.confirm.reset }));
    expect(await screen.findByText('novaLozinka1')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: adminCopy.common.close }));

    await userEvent.click(screen.getByRole('button', { name: adminCopy.actions.deactivate }));
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: adminCopy.confirm.deactivate }),
    );
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(adminCopy.messages.deactivated));

    await userEvent.click(screen.getByRole('button', { name: adminCopy.actions.delete }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: adminCopy.confirm.delete }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(adminCopy.messages.deleted));
  });

  it('shows the API error message', async () => {
    mockedFetch.mockResolvedValueOnce(json({ message: 'Ovo je dostupno samo superadminu.' }, 403));
    render(<AccountsPage copy={adminCopy} appUrl="http://localhost:3000" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Ovo je dostupno samo superadminu.');
  });
});

describe('AppShell (UC-07)', () => {
  const phoneCopy = {
    title: 'Dodajte broj telefona',
    text: 'Broj je obavezan.',
    label: 'Telefon',
    save: 'Sačuvaj broj',
    willSave: 'Biće sačuvan kao {{phone}}',
    logout: 'Odjavi se',
  };

  it('opens the phone dialog only when the account has no number', () => {
    const { rerender } = render(
      <AppShell
        nav={{
          dashboard: 'Pregled',
          guests: 'Gosti',
          invitation: 'Pozivnica',
          photos: 'Fotografije',
          bigAlbum: 'Veliki album',
          settings: 'Podešavanja',
        }}
        hasPhone={false}
        logoutLabel="Odjavi se"
        phoneCopy={phoneCopy}
      >
        <p>sadržaj</p>
      </AppShell>,
    );
    expect(screen.getByRole('dialog')).toHaveTextContent('Dodajte broj telefona');

    rerender(
      <AppShell
        nav={{
          dashboard: 'Pregled',
          guests: 'Gosti',
          invitation: 'Pozivnica',
          photos: 'Fotografije',
          bigAlbum: 'Veliki album',
          settings: 'Podešavanja',
        }}
        hasPhone
        logoutLabel="Odjavi se"
        phoneCopy={phoneCopy}
      >
        <p>sadržaj</p>
      </AppShell>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
