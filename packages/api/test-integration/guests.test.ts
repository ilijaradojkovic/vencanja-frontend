import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';

import { app } from '../src/app.ts';
import { closeDb, getDb } from '../src/db/client.ts';
import { events, guests, photos, profiles } from '../src/db/schema.ts';

/**
 * Guest management against the real local database (M3): create/list/import/edit
 * with companion rules and SYS-5 trimming, delete keeping photos, ownership.
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

const call = (path: string, method: string, token: string, body?: unknown) =>
  app.request(path, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

type Guest = {
  id: string;
  weddingId: string;
  name: string;
  token: string;
  email: string;
  phone: string;
  side: string;
  companions: { type: string; max: number; names: string[] };
  maxPersons: number;
  rsvp: { status: string; persons: number; companions: string[]; note: string; respondedAt: string | null };
  photoNotify: { email: string; requestedAt: string | null; sentAt: string | null };
};

const organizer = async (): Promise<{ token: string; eventId: string }> => {
  const email = unique('guest-owner');
  await createUser(email);
  const token = await signIn(email);
  const onboarding = await call('/api/onboarding', 'POST', token, {
    type: 'wedding',
    partner1: 'Ana',
    partner2: 'Marko',
    date: '2027-06-12',
    phone: '064 123 4567',
  });
  const body = await onboarding.json();
  return { token, eventId: body.wedding.id as string };
};

const GUEST_ID_PATH = /^\/guests\/[0-9a-f-]{36}$/;
const api = async (token: string, eventId: string, path: string, method: string, body?: unknown) => {
  const url = GUEST_ID_PATH.test(path) ? `/api${path}` : `/api/weddings/${eventId}${path}`;
  const response = await call(url, method, token, body);
  return { response, body: await response.json() };
};

const create = async (token: string, eventId: string, body: Record<string, unknown> = {}) => {
  const result = await api(token, eventId, '/guests', 'POST', { name: 'Jelena Petrović', ...body });
  return result.body.guest as Guest;
};

afterAll(async () => {
  const db = getDb();
  for (const id of created) {
    await db.delete(profiles).where(eq(profiles.id, id));
    await fetch(`${supabaseUrl}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: adminHeaders });
  }
  await closeDb();
});

describe('guest authorization', () => {
  it('requires a token and hides another organizer’s event and guests', async () => {
    const owner = await organizer();
    const other = await organizer();
    const guest = await create(owner.token, owner.eventId);

    expect((await call(`/api/weddings/${owner.eventId}/guests`, 'GET', '')).status).toBe(401);

    const foreignList = await api(other.token, owner.eventId, '/guests', 'GET');
    expect(foreignList.response.status).toBe(404);
    expect(foreignList.body.code).toBe('weddingNotFound');

    const foreignCreate = await api(other.token, owner.eventId, '/guests', 'POST', { name: 'X' });
    expect(foreignCreate.response.status).toBe(404);

    const foreignPatch = await api(other.token, owner.eventId, `/guests/${guest.id}`, 'PATCH', { name: 'Y' });
    expect(foreignPatch.response.status).toBe(404);
    expect(foreignPatch.body.code).toBe('guestNotFound');

    const foreignDelete = await api(other.token, owner.eventId, `/guests/${guest.id}`, 'DELETE');
    expect(foreignDelete.response.status).toBe(404);

    const unknown = await api(owner.token, owner.eventId, '/guests/00000000-0000-4000-8000-000000000000', 'PATCH', {
      name: 'Y',
    });
    expect(unknown.response.status).toBe(404);
  });
});

describe('POST /weddings/:id/guests (UC-17, UC-18)', () => {
  it('creates a guest with defaults, a personal token and pending RSVP', async () => {
    const { token, eventId } = await organizer();
    const result = await api(token, eventId, '/guests', 'POST', {
      name: '  Porodica Petrović  ',
      phone: '064 123 4567',
    });
    const guest = result.body.guest as Guest;

    expect(result.response.status).toBe(201);
    expect(guest).toMatchObject({
      name: 'Porodica Petrović',
      weddingId: eventId,
      email: '',
      phone: '+381641234567',
      side: 'zajednicki',
      companions: { type: 'none', max: 0, names: [] },
      maxPersons: 1,
      rsvp: { status: 'pending', persons: 0, companions: [], note: '', respondedAt: null },
      photoNotify: { email: '', requestedAt: null, sentAt: null },
    });
    expect(guest.token).toMatch(/^[0-9A-Za-z]{12}$/);
    expect(guest.openedAt).toBeNull();
    expect(guest.invitedAt).toBeTruthy();
  });

  it('issues unique tokens', async () => {
    const { token, eventId } = await organizer();
    const tokens = new Set<string>();
    for (let index = 0; index < 5; index += 1)
      tokens.add((await create(token, eventId, { name: `Gost ${index}` })).token);
    expect(tokens.size).toBe(5);
  });

  it('validates names, email, phone, side and companions', async () => {
    const { token, eventId } = await organizer();
    const cases: [Record<string, unknown>, string][] = [
      [{ name: '   ' }, 'guestNameRequired'],
      [{ name: 'x'.repeat(121) }, 'textTooLong'],
      [{ email: 'nije-email' }, 'invalidEmail'],
      [{ phone: '123' }, 'invalidPhone'],
      [{ side: 'rodbina' }, 'badSide'],
      [{ companions: { type: 'named', names: [] } }, 'namedCompanionRequired'],
      [{ companions: { type: 'named', names: Array.from({ length: 20 }, (_, i) => `G${i}`) } }, 'tooManyCompanions'],
      [{ companions: { type: 'open', max: 0 } }, 'companionsRange'],
      [{ companions: { type: 'open', max: 20 } }, 'companionsRange'],
    ];
    for (const [body, code] of cases) {
      const result = await api(token, eventId, '/guests', 'POST', { name: 'Gost', ...body });
      expect(result.response.status).toBe(422);
      expect(result.body.code).toBe(code);
    }
  });

  it('derives maxPersons from named and open companions', async () => {
    const { token, eventId } = await organizer();
    const named = await create(token, eventId, {
      name: 'Ana',
      companions: { type: 'named', names: ['Nikola', 'Mila'] },
    });
    expect(named.companions).toEqual({ type: 'named', max: 2, names: ['Nikola', 'Mila'] });
    expect(named.maxPersons).toBe(3);

    const open = await create(token, eventId, { name: 'Marko', companions: { type: 'open', max: 3 } });
    expect(open.maxPersons).toBe(4);
  });
});

describe('GET /weddings/:id/guests and import (UC-19)', () => {
  it('lists the guests of the event only', async () => {
    const first = await organizer();
    const second = await organizer();
    await create(first.token, first.eventId, { name: 'Prvi' });
    await create(second.token, second.eventId, { name: 'Drugi' });

    const list = await api(first.token, first.eventId, '/guests', 'GET');
    expect(list.response.status).toBe(200);
    expect((list.body.guests as Guest[]).map((guest) => guest.name)).toEqual(['Prvi']);
  });

  it('imports normalized rows, skips empty names and caps the list at 1000', async () => {
    const { token, eventId } = await organizer();
    const result = await api(token, eventId, '/guests/import', 'POST', {
      guests: [
        { name: 'Porodica Jovanović', maxPersons: 4, phone: '060 111 2222', side: 'mlada' },
        { name: '  ' },
        { name: 'Luka', phone: 'nije-broj', email: 'nije-email', side: 'nepoznato' },
        { name: 'Mila', email: 'MILA@USPOMENA.TEST' },
      ],
    });
    const imported = result.body.guests as Guest[];

    expect(result.response.status).toBe(201);
    expect(imported).toHaveLength(3);
    expect(imported[0]).toMatchObject({
      name: 'Porodica Jovanović',
      phone: '+381601112222',
      side: 'mlada',
      companions: { type: 'open', max: 3 },
      maxPersons: 4,
    });
    expect(imported[1]).toMatchObject({ name: 'Luka', phone: '', email: '', side: 'zajednicki', maxPersons: 1 });
    expect(imported[2]).toMatchObject({ email: 'mila@uspomena.test' });

    const tooMany = await api(token, eventId, '/guests/import', 'POST', {
      guests: Array.from({ length: 1001 }, (_, i) => ({ name: `Gost ${i}` })),
    });
    expect(tooMany.response.status).toBe(422);
    expect(tooMany.body.code).toBe('tooManyGuests');

    const empty = await api(token, eventId, '/guests/import', 'POST', { guests: [] });
    expect(empty.response.status).toBe(201);
    expect(empty.body.guests).toEqual([]);
  });
});

describe('PATCH /guests/:id (UC-18, UC-23, UC-24, SYS-5)', () => {
  it('updates the guest fields and keeps the token', async () => {
    const { token, eventId } = await organizer();
    const guest = await create(token, eventId);

    const result = await api(token, eventId, `/guests/${guest.id}`, 'PATCH', {
      name: 'Jelena Nikolić',
      email: 'JELENA@USPOMENA.TEST',
      phone: '060 111 2222',
      side: 'mlada',
    });
    const updated = result.body.guest as Guest;

    expect(result.response.status).toBe(200);
    expect(updated).toMatchObject({
      id: guest.id,
      token: guest.token,
      name: 'Jelena Nikolić',
      email: 'jelena@uspomena.test',
      phone: '+381601112222',
      side: 'mlada',
    });

    const invalid = await api(token, eventId, `/guests/${guest.id}`, 'PATCH', { name: ' ' });
    expect(invalid.body.code).toBe('guestNameRequired');
  });

  it('trims an existing "coming" answer when companions shrink (SYS-5)', async () => {
    const { token, eventId } = await organizer();
    const guest = await create(token, eventId, {
      name: 'Ana',
      companions: { type: 'named', names: ['Nikola', 'Mila'] },
    });

    const rsvp = await api(token, eventId, `/guests/${guest.id}`, 'PATCH', {
      rsvp: { status: 'yes', companions: ['Nikola', 'Mila'], note: 'Dolazimo!' },
    });
    expect(rsvp.body.guest.rsvp).toMatchObject({ status: 'yes', persons: 3, companions: ['Nikola', 'Mila'] });
    expect(rsvp.body.guest.rsvp.respondedAt).toBeTruthy();

    const shrunk = await api(token, eventId, `/guests/${guest.id}`, 'PATCH', {
      companions: { type: 'named', names: ['Nikola'] },
    });
    expect(shrunk.body.guest.companions).toEqual({ type: 'named', max: 1, names: ['Nikola'] });
    expect(shrunk.body.guest.maxPersons).toBe(2);
    expect(shrunk.body.guest.rsvp).toMatchObject({ status: 'yes', persons: 2, companions: ['Nikola'] });
  });

  it('lowers an open answer to the new maximum and leaves pending answers alone', async () => {
    const { token, eventId } = await organizer();
    const guest = await create(token, eventId, { name: 'Marko', companions: { type: 'open', max: 3 } });

    await api(token, eventId, `/guests/${guest.id}`, 'PATCH', {
      rsvp: { status: 'yes', persons: 4, companions: ['A', 'B', 'C'] },
    });
    const shrunk = await api(token, eventId, `/guests/${guest.id}`, 'PATCH', {
      companions: { type: 'open', max: 1 },
    });
    expect(shrunk.body.guest.rsvp).toMatchObject({ status: 'yes', persons: 2, companions: ['A'] });

    const pending = await api(token, eventId, `/guests/${guest.id}`, 'PATCH', {
      rsvp: { status: 'pending' },
    });
    expect(pending.body.guest.rsvp).toMatchObject({ status: 'pending', persons: 0, companions: [], respondedAt: null });
  });

  it('applies the RSVP rules for manual entry', async () => {
    const { token, eventId } = await organizer();
    const named = await create(token, eventId, {
      name: 'Ana',
      companions: { type: 'named', names: ['Nikola'] },
    });
    const open = await create(token, eventId, { name: 'Marko', companions: { type: 'open', max: 2 } });

    const uninvited = await api(token, eventId, `/guests/${named.id}`, 'PATCH', {
      rsvp: { status: 'yes', companions: ['Mila'] },
    });
    expect(uninvited.body.code).toBe('companionNotInvited');

    const range = await api(token, eventId, `/guests/${open.id}`, 'PATCH', {
      rsvp: { status: 'yes', persons: 5 },
    });
    expect(range.body.code).toBe('personsRange');

    const no = await api(token, eventId, `/guests/${named.id}`, 'PATCH', { rsvp: { status: 'no', note: 'Nažalost' } });
    expect(no.body.guest.rsvp).toMatchObject({ status: 'no', persons: 0, companions: [], note: 'Nažalost' });

    const badStatus = await api(token, eventId, `/guests/${named.id}`, 'PATCH', { rsvp: { status: 'maybe' } });
    expect(badStatus.body.code).toBe('chooseAttendance');
  });
});

describe('DELETE /guests/:id (UC-25)', () => {
  it('removes the guest, keeps their photos and stops the personal link', async () => {
    const { token, eventId } = await organizer();
    const guest = await create(token, eventId, { name: 'Ana' });

    const [photo] = await getDb()
      .insert(photos)
      .values({ eventId, guestId: guest.id, status: 'approved', mime: 'image/jpeg', sizeBytes: 10 })
      .returning();
    expect(photo?.guestId).toBe(guest.id);

    const deleted = await api(token, eventId, `/guests/${guest.id}`, 'DELETE');
    expect(deleted.response.status).toBe(200);
    expect(deleted.body).toEqual({ id: guest.id });

    const remaining = await getDb().select().from(guests).where(eq(guests.id, guest.id));
    expect(remaining).toHaveLength(0);

    const [keptPhoto] = await getDb()
      .select()
      .from(photos)
      .where(eq(photos.id, photo?.id ?? ''));
    expect(keptPhoto?.guestId).toBeNull();

    const again = await api(token, eventId, `/guests/${guest.id}`, 'DELETE');
    expect(again.response.status).toBe(404);

    // The event itself is untouched by guest deletion.
    const [event] = await getDb().select().from(events).where(eq(events.id, eventId));
    expect(event?.id).toBe(eventId);
  });
});
