import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GuestsPage } from '../src/features/guests/GuestsPage';
import { InvitationEditor } from '../src/features/invite/InvitationEditor';
import { InvitationExperience } from '../src/features/invite/InvitationExperience';
import { LocaleProvider } from '../src/lib/i18n/client';
import { apiFetch } from '../src/lib/diagnostics/api';

vi.mock('../src/lib/diagnostics/api', () => ({ apiFetch: vi.fn() }));
const mockedFetch = vi.mocked(apiFetch);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const wedding = {
  id: 'wedding-1',
  type: 'wedding' as const,
  occasion: '',
  slug: 'ana-i-marko',
  partner1: 'Ana',
  partner2: 'Marko',
  date: '2027-06-12',
  rsvpDeadline: '2027-05-20',
  city: 'Beograd',
  invitation: {
    templateId: 'klasik',
    accentColor: '#2D4A3E',
    headline: 'Venčavamo se',
    message: 'Pozivamo vas.',
    schedule: [{ time: '17:00', title: 'Ceremonija', place: 'Crkva', mapUrl: '' }],
  },
  settings: {
    autoApprovePhotos: false,
    allowGeneralUpload: true,
    galleryOpen: 'after_wedding',
    galleryManualOpen: false,
    galleryViaQr: true,
  },
};

const guest = {
  id: 'guest-1',
  name: 'Jelena Petrović',
  token: 'abcdefghijkl',
  email: 'jelena@uspomena.test',
  phone: '+381641234567',
  side: 'mlada' as const,
  companions: { type: 'named' as const, max: 1, names: ['Nikola'] },
  maxPersons: 2,
  openedAt: '2026-11-22T10:00:00.000Z',
  rsvp: {
    status: 'yes' as const,
    persons: 2,
    companions: ['Nikola'],
    note: 'Jedva čekamo',
    respondedAt: '2026-11-22T10:00:00.000Z',
  },
  photoNotify: { email: 'jelena@uspomena.test', requestedAt: '2026-11-22T10:00:00.000Z', sentAt: null },
};

beforeEach(() => mockedFetch.mockReset());
afterEach(() => vi.restoreAllMocks());

const withProvider = (ui: React.ReactElement) => render(<LocaleProvider locale="sr">{ui}</LocaleProvider>);

describe('GuestsPage (UC-17 – UC-26)', () => {
  it('lists and filters guests, adds, imports and deletes through the API', async () => {
    mockedFetch.mockImplementation(async (rawUrl: string, init?: RequestInit) => {
      const url = String(rawUrl ?? '');
      if (url === '/api/weddings/current') return json({ wedding });
      if (url.endsWith('/guests') && (init?.method ?? 'GET') === 'GET') {
        return json({
          guests: [
            guest,
            {
              ...guest,
              id: 'guest-2',
              name: 'Marija',
              rsvp: { ...guest.rsvp, status: 'pending', persons: 0, companions: [], note: '' },
              side: 'zajednicki',
              companions: { type: 'none', max: 0, names: [] },
            },
          ],
        });
      }
      if (url.endsWith('/guests/import'))
        return json({ guests: [{ ...guest, id: 'guest-3', name: 'Kum Petar' }] }, 201);
      if (url.endsWith('/guests') && init?.method === 'POST')
        return json({ guest: { ...guest, id: 'guest-4', name: 'Nova Gost' } }, 201);
      if (url.startsWith('/api/guests/') && init?.method === 'DELETE') return json({ id: 'guest-1' });
      return json({});
    });

    withProvider(<GuestsPage />);
    expect(await screen.findByText('Jelena Petrović')).toBeInTheDocument();
    expect(screen.getByText('sa: Nikola')).toBeInTheDocument();
    expect(screen.getAllByText('Dolazi').length).toBeGreaterThan(0);

    await userEvent.type(screen.getByPlaceholderText('Pretraži goste…'), 'Marija');
    expect(screen.queryByText('Jelena Petrović')).not.toBeInTheDocument();
    await userEvent.clear(screen.getByPlaceholderText('Pretraži goste…'));
    await userEvent.click(screen.getByRole('button', { name: /Ne dolaze/ }));

    await userEvent.click(screen.getByRole('button', { name: /Novi gost/ }));
    const modal = screen.getByRole('dialog');
    await userEvent.type(within(modal).getByLabelText('Ime (kako piše na pozivnici)'), 'Nova Gost');
    await userEvent.click(within(modal).getByRole('button', { name: 'Sačuvaj' }));
    await waitFor(() =>
      expect(mockedFetch).toHaveBeenCalledWith(
        '/api/weddings/wedding-1/guests',
        expect.objectContaining({ method: 'POST' }),
      ),
    );

    await userEvent.click(screen.getByRole('button', { name: /Uvezi spisak/ }));
    await userEvent.type(screen.getByLabelText('Spisak gostiju'), 'Kum Petar; 2');
    await userEvent.click(screen.getByRole('button', { name: 'Uvezi (1)' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Dodato gostiju: 1'));

    await userEvent.click(screen.getByRole('button', { name: /^Svi/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Obriši Jelena Petrović' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Obriši' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Gost je obrisan'));
  });
});

describe('InvitationEditor (UC-27 – UC-32)', () => {
  it('renders the 11 looks, edits the template/colour/text and saves', async () => {
    mockedFetch.mockImplementation(async (rawUrl: string, init?: RequestInit) => {
      const url = String(rawUrl ?? '');
      if (url === '/api/weddings/current') return json({ wedding });
      if (url.startsWith('/api/weddings/wedding-1') && init?.method === 'PATCH') {
        const body = JSON.parse(String(init.body)) as { invitation?: unknown };
        return json({ wedding: { ...wedding, invitation: { ...wedding.invitation, ...(body.invitation as object) } } });
      }
      return json({});
    });

    withProvider(<InvitationEditor sampleGuestName="Jelena Petrović" />);
    expect(await screen.findByRole('heading', { name: 'Pozivnica' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(11);
    expect(screen.getByText('Botanika')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: /Botanika/ }));
    expect(screen.getByRole('radio', { name: /Botanika/ })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Boja #5E7A4E' }));
    await userEvent.type(screen.getByLabelText('Uvodna rečenica'), '!');
    await userEvent.click(screen.getByRole('button', { name: 'Sačuvaj izmene' }));

    await waitFor(() =>
      expect(mockedFetch).toHaveBeenCalledWith(
        '/api/weddings/wedding-1',
        expect.objectContaining({ method: 'PATCH', body: expect.stringContaining('botanika') }),
      ),
    );
    expect(await screen.findByText('Pozivnica je sačuvana')).toBeInTheDocument();
  });
});

describe('InvitationExperience (UC-58 – UC-64)', () => {
  it('opens the envelope, saves an RSVP and the notify email', async () => {
    mockedFetch.mockImplementation(async (rawUrl: string, init?: RequestInit) => {
      const url = String(rawUrl ?? '');
      if (url.endsWith('/opened')) return json({ ok: true });
      if (url.endsWith('/rsvp')) {
        return json({
          rsvp: {
            status: 'yes',
            persons: 2,
            companions: ['Nikola'],
            note: '',
            respondedAt: '2026-11-22T10:00:00.000Z',
          },
        });
      }
      if (url.endsWith('/notify')) return json({ notifyEmail: 'jelena@uspomena.test' });
      void init;
      return json({});
    });

    withProvider(
      <InvitationExperience
        token={guest.token}
        initialGuest={{
          name: guest.name,
          token: guest.token,
          maxPersons: guest.maxPersons,
          companions: guest.companions,
          rsvp: { status: 'pending', persons: 0, companions: [], note: '', respondedAt: null },
          notifyEmail: '',
          prefillEmail: guest.email,
        }}
        wedding={{
          ...wedding,
          settings: { allowGeneralUpload: true },
          gallery: { open: false, mode: 'after_wedding', opensAt: '2027-06-13', viaQr: true },
        }}
      />,
    );

    expect(screen.getByRole('heading', { name: /Jelena Petrović/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Otvori pozivnicu' }));
    expect(await screen.findByRole('heading', { name: 'Potvrdite dolazak' }, { timeout: 3000 })).toBeInTheDocument();
    await expect(screen.getByText('Venčavamo se')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Dolazim' }));
    await userEvent.click(screen.getByLabelText('Nikola'));
    await userEvent.click(screen.getByRole('button', { name: 'Potvrdi' }));
    expect(await screen.findByRole('heading', { name: 'Hvala, vidimo se!' }, { timeout: 3000 })).toBeInTheDocument();

    const emailInput = screen.getAllByLabelText(/^Email/)[0];
    if (!emailInput) throw new Error('Notify email field is missing.');
    await userEvent.clear(emailInput);
    await userEvent.type(emailInput, 'jelena@uspomena.test');
    await userEvent.click(screen.getByRole('button', { name: 'Obavesti me' }));
    expect(await screen.findByText('Sa vama: Nikola')).toBeInTheDocument();
  });
});
