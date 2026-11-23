import { and, eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';

import { app } from '../src/app.ts';
import { closeDb, getDb } from '../src/db/client.ts';
import { guests, photoSubscribers, photos, profiles } from '../src/db/schema.ts';

/**
 * Public guest endpoints against the real local database (M3): invitation by
 * token, first `opened`, RSVP rules, notify/notify_locale, the public wedding by
 * slug and the gallery with SYS-3 in Europe/Belgrade.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const adminHeaders = { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json' };
const password = 'integration-123';
const created: string[] = [];
const unique = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}@uspomena.test`;

const createUser = async (email: string): Promise<string> => {
  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { locale: 'sr' } }),
  });
  const user = (await response.json()) as { id: string };
  created.push(user.id);
  return user.id;
};

const signIn = async (email: string): Promise<string> => {
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: publishableKey || serviceKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return ((await response.json()) as { access_token?: string }).access_token ?? '';
};

const call = (path: string, method: string, body?: unknown, token?: string, headers: Record<string, string> = {}) =>
  app.request(path, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

type PublicInvitation = {
  guest: {
    name: string;
    token: string;
    maxPersons: number;
    companions: { type: string; max: number; names: string[] };
    rsvp: { status: string; persons: number; companions: string[]; note: string; respondedAt: string | null };
    notifyEmail: string;
    prefillEmail: string;
  };
  wedding: {
    type: string;
    occasion: string;
    slug: string;
    partner1: string;
    partner2: string;
    date: string;
    rsvpDeadline: string | null;
    city: string;
    invitation: { templateId: string; schedule: unknown[] };
    settings: { allowGeneralUpload: boolean };
    gallery: { open: boolean; mode: string; opensAt: string | null; viaQr: boolean };
  };
};

const setup = async (
  options: { guestEmail?: string; companions?: unknown; settings?: Record<string, unknown> } = {},
) => {
  const organizerEmail = unique('public-owner');
  await createUser(organizerEmail);
  const token = await signIn(organizerEmail);
  const onboarding = await call(
    '/api/onboarding',
    'POST',
    {
      type: 'wedding',
      partner1: 'Ana',
      partner2: 'Marko',
      date: '2027-06-12',
      phone: '064 123 4567',
    },
    token,
  );
  const wedding = (await onboarding.json()).wedding as { id: string; slug: string };

  if (options.settings) {
    await call(`/api/weddings/${wedding.id}`, 'PATCH', { settings: options.settings }, token);
  }

  const guestResponse = await call(
    `/api/weddings/${wedding.id}/guests`,
    'POST',
    { name: 'Jelena Petrović', email: options.guestEmail ?? '', companions: options.companions },
    token,
  );
  const guest = (await guestResponse.json()).guest as { id: string; token: string };
  return { organizerToken: token, eventId: wedding.id, slug: wedding.slug, guest };
};

const invitation = async (guestToken: string, headers: Record<string, string> = {}) => {
  const response = await call(`/api/public/invitations/${guestToken}`, 'GET', undefined, undefined, headers);
  return { response, body: (await response.json()) as PublicInvitation };
};

afterAll(async () => {
  const db = getDb();
  for (const id of created) {
    await db.delete(profiles).where(eq(profiles.id, id));
    await fetch(`${supabaseUrl}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: adminHeaders });
  }
  await closeDb();
});

describe('GET /api/public/invitations/:token', () => {
  it('returns the public guest and wedding without private data', async () => {
    const { guest, slug } = await setup({ guestEmail: 'Jelena@Uspomena.test' });
    const { response, body } = await invitation(guest.token);

    expect(response.status).toBe(200);
    expect(body.guest).toMatchObject({
      name: 'Jelena Petrović',
      token: guest.token,
      maxPersons: 1,
      companions: { type: 'none', max: 0, names: [] },
      rsvp: { status: 'pending', persons: 0, companions: [], note: '', respondedAt: null },
      notifyEmail: '',
      prefillEmail: 'jelena@uspomena.test',
    });
    expect(body.wedding).toMatchObject({
      slug,
      partner1: 'Ana',
      partner2: 'Marko',
      date: '2027-06-12',
      rsvpDeadline: null,
      settings: { allowGeneralUpload: true },
      gallery: { open: false, mode: 'after_wedding', opensAt: '2027-06-13', viaQr: true },
    });
    expect(body.wedding.invitation.templateId).toBe('klasik');
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('+381');
    expect(serialized).not.toContain('public-owner');
  });

  it('answers 404 for an unknown token', async () => {
    const response = await call('/api/public/invitations/does-not-exist', 'GET');
    expect(response.status).toBe(404);
    expect((await response.json()).code).toBe('invitationNotFound');
  });
});

describe('POST /api/public/invitations/:token/opened', () => {
  it('sets openedAt once and keeps the first timestamp', async () => {
    const { guest } = await setup();
    const first = await call(`/api/public/invitations/${guest.token}/opened`, 'POST');
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ ok: true });

    const [row] = await getDb().select().from(guests).where(eq(guests.id, guest.id));
    const openedAt = row?.openedAt;
    expect(openedAt).toBeTruthy();

    await call(`/api/public/invitations/${guest.token}/opened`, 'POST');
    const [again] = await getDb().select().from(guests).where(eq(guests.id, guest.id));
    expect(again?.openedAt?.getTime()).toBe(openedAt?.getTime());
  });
});

describe('POST /api/public/invitations/:token/rsvp', () => {
  it('records a named-companion answer and respondsAt', async () => {
    const { guest } = await setup({ companions: { type: 'named', names: ['Nikola', 'Mila'] } });

    const response = await call(`/api/public/invitations/${guest.token}/rsvp`, 'POST', {
      status: 'yes',
      companions: ['Nikola'],
      note: 'Jedva čekamo!',
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.rsvp).toMatchObject({
      status: 'yes',
      persons: 2,
      companions: ['Nikola'],
      note: 'Jedva čekamo!',
    });
    expect(body.rsvp.respondedAt).toBeTruthy();

    const { body: updated } = await invitation(guest.token);
    expect(updated.guest.rsvp).toMatchObject({ status: 'yes', persons: 2 });
  });

  it('validates the answer with the shared rules', async () => {
    const named = await setup({ companions: { type: 'named', names: ['Nikola'] } });
    const open = await setup({ companions: { type: 'open', max: 2 } });

    const uninvited = await call(`/api/public/invitations/${named.guest.token}/rsvp`, 'POST', {
      status: 'yes',
      companions: ['Mila'],
    });
    expect(uninvited.status).toBe(422);
    expect((await uninvited.json()).code).toBe('companionNotInvited');

    const range = await call(`/api/public/invitations/${open.guest.token}/rsvp`, 'POST', {
      status: 'yes',
      persons: 5,
    });
    expect((await range.json()).code).toBe('personsRange');

    const pending = await call(`/api/public/invitations/${open.guest.token}/rsvp`, 'POST', { status: 'pending' });
    expect(pending.status).toBe(422);
    expect((await pending.json()).code).toBe('chooseAttendance');

    const longNote = await call(`/api/public/invitations/${open.guest.token}/rsvp`, 'POST', {
      status: 'no',
      note: 'x'.repeat(1001),
    });
    expect((await longNote.json()).code).toBe('textTooLong');

    const no = await call(`/api/public/invitations/${open.guest.token}/rsvp`, 'POST', {
      status: 'no',
      note: 'Nažalost',
    });
    expect((await no.json()).rsvp).toMatchObject({ status: 'no', persons: 0, companions: [], note: 'Nažalost' });
  });
});

describe('POST /api/public/invitations/:token/notify', () => {
  it('stores the address and locale, and a new address resets sentAt (SYS-4)', async () => {
    const { guest } = await setup();
    const first = await call(
      `/api/public/invitations/${guest.token}/notify`,
      'POST',
      { email: 'GOST@Uspomena.test' },
      undefined,
      {
        'accept-language': 'en',
      },
    );
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ notifyEmail: 'gost@uspomena.test' });

    const [row] = await getDb().select().from(guests).where(eq(guests.id, guest.id));
    expect(row).toMatchObject({ notifyEmail: 'gost@uspomena.test', notifyLocale: 'en' });
    expect(row?.notifyRequestedAt).toBeTruthy();
    expect(row?.notifySentAt).toBeNull();

    await getDb().update(guests).set({ notifySentAt: new Date() }).where(eq(guests.id, guest.id));
    await call(`/api/public/invitations/${guest.token}/notify`, 'POST', { email: 'gost@uspomena.test' });
    const [same] = await getDb().select().from(guests).where(eq(guests.id, guest.id));
    expect(same?.notifySentAt).not.toBeNull();

    await call(`/api/public/invitations/${guest.token}/notify`, 'POST', { email: 'novo@uspomena.test' });
    const [changed] = await getDb().select().from(guests).where(eq(guests.id, guest.id));
    expect(changed?.notifyEmail).toBe('novo@uspomena.test');
    expect(changed?.notifySentAt).toBeNull();
  });

  it('rejects an invalid email', async () => {
    const { guest } = await setup();
    const response = await call(`/api/public/invitations/${guest.token}/notify`, 'POST', { email: 'nije-email' });
    expect(response.status).toBe(422);
    expect((await response.json()).code).toBe('invalidEmail');
  });
});

describe('GET /api/public/weddings/:slug', () => {
  it('returns the public wedding and 404 for an unknown slug', async () => {
    const { slug } = await setup();
    const response = await call(`/api/public/weddings/${slug}`, 'GET');
    expect(response.status).toBe(200);
    expect((await response.json()).wedding.slug).toBe(slug);

    const unknown = await call('/api/public/weddings/ne-postoji', 'GET');
    expect(unknown.status).toBe(404);
    expect((await unknown.json()).code).toBe('weddingNotFound');
  });
});

describe('gallery (SYS-3, Europe/Belgrade)', () => {
  const addPhotos = async (eventId: string) => {
    await getDb()
      .insert(photos)
      .values([
        { eventId, status: 'approved', senderName: 'Gost', category: 'wedding', message: 'Prva' },
        { eventId, status: 'approved', senderName: 'Gost', category: 'memories', message: 'Druga' },
        { eventId, status: 'pending', senderName: 'Gost', category: 'wedding', message: 'Na čekanju' },
      ]);
  };

  it('is empty while closed and lists only approved photos when open', async () => {
    const { organizerToken, guest, eventId } = await setup();
    await addPhotos(eventId);

    const closed = await call(`/api/public/invitations/${guest.token}/gallery`, 'GET');
    expect((await closed.json()).gallery).toMatchObject({ open: false, photos: [] });

    // "Now" opens immediately for the personal link.
    await call(`/api/weddings/${eventId}`, 'PATCH', { settings: { galleryOpen: 'now' } }, organizerToken);
    const nowOpen = await call(`/api/public/invitations/${guest.token}/gallery`, 'GET');
    const gallery = (await nowOpen.json()).gallery;
    expect(gallery.open).toBe(true);
    expect(gallery.photos.map((photo: { message: string }) => photo.message)).toEqual(['Prva', 'Druga']);
    expect(gallery.photos[0]).toMatchObject({ url: null, thumbUrl: null, category: 'wedding' });
  });

  it('follows the after-wedding mode in Europe/Belgrade and the manual switch', async () => {
    const { organizerToken, eventId, guest } = await setup();

    await call(`/api/weddings/${eventId}`, 'PATCH', { date: '2020-01-01' }, organizerToken);
    const past = await call(`/api/public/invitations/${guest.token}/gallery`, 'GET');
    expect((await past.json()).gallery).toMatchObject({ open: true, opensAt: '2020-01-02' });

    await call(
      `/api/weddings/${eventId}`,
      'PATCH',
      { settings: { galleryOpen: 'manual', galleryManualOpen: false } },
      organizerToken,
    );
    const manualClosed = await call(`/api/public/invitations/${guest.token}/gallery`, 'GET');
    expect((await manualClosed.json()).gallery.open).toBe(false);

    await call(`/api/weddings/${eventId}`, 'PATCH', { settings: { galleryManualOpen: true } }, organizerToken);
    const manualOpen = await call(`/api/public/invitations/${guest.token}/gallery`, 'GET');
    expect((await manualOpen.json()).gallery.open).toBe(true);
  });

  it('blocks the QR gallery when galleryViaQr is off but keeps the personal link working', async () => {
    const { guest, slug } = await setup({ settings: { galleryViaQr: false, galleryOpen: 'now' } });

    const personal = await call(`/api/public/invitations/${guest.token}/gallery`, 'GET');
    expect(personal.status).toBe(200);

    const qr = await call(`/api/public/weddings/${slug}/gallery`, 'GET');
    expect(qr.status).toBe(403);
    expect((await qr.json()).code).toBe('galleryPersonalOnly');
  });
});

describe('POST /api/public/weddings/:slug/notify', () => {
  it('adds a QR subscriber once, with the request language', async () => {
    const { slug, eventId } = await setup();

    const response = await call(
      `/api/public/weddings/${slug}/notify`,
      'POST',
      { email: 'QR@Uspomena.test', name: '  Gost QR  ' },
      undefined,
      { 'accept-language': 'ru' },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ notifyEmail: 'qr@uspomena.test' });

    await call(`/api/public/weddings/${slug}/notify`, 'POST', { email: 'qr@uspomena.test' });
    const rows = await getDb()
      .select()
      .from(photoSubscribers)
      .where(and(eq(photoSubscribers.eventId, eventId), eq(photoSubscribers.email, 'qr@uspomena.test')));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: 'Gost QR', locale: 'ru' });

    const invalid = await call(`/api/public/weddings/${slug}/notify`, 'POST', { email: 'nije-email' });
    expect(invalid.status).toBe(422);
  });

  it('answers 403 when QR is disabled', async () => {
    const { slug } = await setup({ settings: { galleryViaQr: false } });
    const response = await call(`/api/public/weddings/${slug}/notify`, 'POST', { email: 'qr@uspomena.test' });
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('galleryPersonalOnly');
  });
});
