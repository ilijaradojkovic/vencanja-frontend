import { db, persist, uid, token as newToken, resetDb, syncFromStorage } from './db';
import { normalizePhone, PHONE_ERROR } from '../utils/phone';

export class ApiError extends Error {
  constructor(message, status = 0, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

const LATENCY = [250, 650];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const latency = () => sleep(LATENCY[0] + Math.random() * (LATENCY[1] - LATENCY[0]));
const fail = (status, message) => {
  throw new ApiError(message, status, { message });
};
const clone = (x) => JSON.parse(JSON.stringify(x));

const userFromToken = (tok) => {
  const userId = db.sessions[tok];
  const user = db.users.find((u) => u.id === userId);
  if (!user) fail(401, 'Sesija je istekla, prijavite se ponovo.');
  return user;
};
const requireWedding = (ctx, weddingId) => {
  const user = userFromToken(ctx.token);
  if (weddingId && user.weddingId !== weddingId) fail(403, 'Nemate pristup ovom venčanju.');
  const wedding = db.weddings.find((w) => w.id === user.weddingId);
  if (!wedding) fail(404, 'Venčanje nije pronađeno.');
  return wedding;
};
const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name, phone: u.phone || '', weddingId: u.weddingId });

const slugFor = (a, b) => {
  const base = `${a}-i-${b}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'dj').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 34) || 'vencanje';
  let slug = base;
  for (let i = 2; db.weddings.some((w) => w.slug === slug); i++) slug = `${base}-${i}`;
  return slug;
};
const publicWedding = (w) => ({
  slug: w.slug,
  partner1: w.partner1,
  partner2: w.partner2,
  date: w.date,
  rsvpDeadline: w.rsvpDeadline,
  city: w.city,
  invitation: w.invitation,
  settings: { allowGeneralUpload: w.settings.allowGeneralUpload },
});
const guestByToken = (tok) => {
  const g = db.guests.find((x) => x.token === tok);
  if (!g) fail(404, 'Pozivnica nije pronađena. Proverite link.');
  return g;
};

async function fileToDataUrl(file, max = 1100) {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.82);
  } catch {
    return URL.createObjectURL(file);
  }
}

async function savePhotos(wedding, guest, formData, onUploadProgress) {
  const files = formData.getAll('files').filter(Boolean);
  if (!files.length) fail(400, 'Niste izabrali nijednu fotografiju.');
  if (files.length > 50) fail(400, 'Najviše 50 fotografija odjednom.');
  const created = [];
  for (let i = 0; i < files.length; i += 1) {
    const f = files[i];
    if (!f.type?.startsWith('image/')) fail(400, `${f.name} nije slika.`);
    for (let step = 1; step <= 4; step += 1) {
      await sleep(70 + Math.random() * 90);
      onUploadProgress?.(Math.round(((i + step / 4) / files.length) * 100));
    }
    created.push({
      id: uid('p'),
      weddingId: wedding.id,
      guestId: guest?.id || null,
      senderName: formData.get('senderName') || guest?.name || 'Gost',
      category: formData.get('category') === 'memories' ? 'memories' : 'wedding',
      message: formData.get('message') || '',
      status: wedding.settings.autoApprovePhotos ? 'approved' : 'pending',
      url: await fileToDataUrl(f),
      createdAt: new Date().toISOString(),
    });
  }
  db.photos.push(...created);
  persist();
  return { uploaded: created.length, photos: created.map((p) => ({ id: p.id, status: p.status })) };
}

const routes = [
  ['POST', '/auth/login', async ({ body }) => {
    const user = db.users.find((u) => u.email.toLowerCase() === String(body?.email || '').toLowerCase().trim());
    if (!user || user.password !== body?.password) fail(401, 'Pogrešan email ili lozinka.');
    const tok = `mock_${newToken()}`;
    db.sessions[tok] = user.id;
    persist();
    return { token: tok, user: publicUser(user) };
  }],
  ['GET', '/auth/me', async (ctx) => ({ user: publicUser(userFromToken(ctx.token)) })],
  ['POST', '/auth/register', async ({ body }) => {
    const b = body || {};
    const email = String(b.email || '').toLowerCase().trim();
    const partner1 = String(b.partner1 || '').trim();
    const partner2 = String(b.partner2 || '').trim();
    const phone = normalizePhone(b.phone);
    if (!/^\S+@\S+\.\S+$/.test(email)) fail(422, 'Unesite ispravan email.');
    if (String(b.password || '').length < 6) fail(422, 'Lozinka mora imati bar 6 znakova.');
    if (!partner1 || !partner2) fail(422, 'Unesite imena mladenaca.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.date || ''))) fail(422, 'Unesite datum venčanja.');
    if (!phone) fail(422, PHONE_ERROR);
    if (db.users.some((u) => u.email.toLowerCase() === email)) fail(409, 'Nalog sa ovim emailom već postoji.');

    const wedding = {
      id: uid('w'),
      slug: slugFor(partner1, partner2),
      partner1,
      partner2,
      date: b.date,
      rsvpDeadline: '',
      city: '',
      invitation: {
        templateId: 'klasik',
        accentColor: '#2D4A3E',
        headline: 'sa radošću vas pozivamo na naše venčanje',
        message: '',
        schedule: [{ id: uid('e'), time: '17:00', title: 'Svečana večera', place: '', mapUrl: '' }],
      },
      settings: { autoApprovePhotos: false, galleryUnlockAfterWedding: true, allowGeneralUpload: true },
    };
    const user = { id: uid('u'), email, password: b.password, name: `${partner1} i ${partner2}`, phone, weddingId: wedding.id };
    db.weddings.push(wedding);
    db.users.push(user);
    const tok = `mock_${newToken()}`;
    db.sessions[tok] = user.id;
    persist();
    return { token: tok, user: publicUser(user) };
  }],
  ['PATCH', '/auth/me', async (ctx) => {
    const user = userFromToken(ctx.token);
    const { name, phone } = ctx.body || {};
    if (phone !== undefined) {
      const clean = normalizePhone(phone);
      if (!clean) fail(422, PHONE_ERROR);
      user.phone = clean;
    }
    if (name !== undefined && String(name).trim()) user.name = String(name).trim();
    persist();
    return { user: publicUser(user) };
  }],

  ['GET', '/weddings/current', async (ctx) => clone(requireWedding(ctx))],
  ['PATCH', '/weddings/:id', async (ctx) => {
    const w = requireWedding(ctx, ctx.params.id);
    const { slug, partner1, partner2, date, rsvpDeadline, city, invitation, settings } = ctx.body || {};
    if (slug !== undefined) {
      const clean = String(slug).toLowerCase().trim();
      if (!/^[a-z0-9-]{3,40}$/.test(clean)) fail(422, 'Adresa može imati samo mala slova, brojeve i crtice (3–40 znakova).');
      w.slug = clean;
    }
    Object.assign(w, Object.fromEntries(Object.entries({ partner1, partner2, date, rsvpDeadline, city }).filter(([, v]) => v !== undefined)));
    if (invitation) w.invitation = { ...w.invitation, ...invitation };
    if (settings) w.settings = { ...w.settings, ...settings };
    persist();
    return clone(w);
  }],

  ['GET', '/weddings/:id/guests', async (ctx) => {
    requireWedding(ctx, ctx.params.id);
    return clone(db.guests.filter((g) => g.weddingId === ctx.params.id));
  }],
  ['POST', '/weddings/:id/guests', async (ctx) => {
    requireWedding(ctx, ctx.params.id);
    const b = ctx.body || {};
    if (!b.name?.trim()) fail(422, 'Ime gosta je obavezno.');
    const g = {
      id: uid('g'),
      weddingId: ctx.params.id,
      name: b.name.trim(),
      token: newToken(),
      email: b.email || '',
      phone: b.phone || '',
      side: b.side || 'zajednicki',
      maxPersons: Math.max(1, Number(b.maxPersons) || 1),
      invitedAt: new Date().toISOString(),
      openedAt: null,
      rsvp: { status: 'pending', persons: 0, note: '', respondedAt: null },
    };
    db.guests.push(g);
    persist();
    return clone(g);
  }],
  ['POST', '/weddings/:id/guests/import', async (ctx) => {
    requireWedding(ctx, ctx.params.id);
    const list = Array.isArray(ctx.body?.guests) ? ctx.body.guests : [];
    const created = list.filter((x) => x.name?.trim()).map((x) => ({
      id: uid('g'),
      weddingId: ctx.params.id,
      name: x.name.trim(),
      token: newToken(),
      email: x.email || '',
      phone: x.phone || '',
      side: x.side || 'zajednicki',
      maxPersons: Math.max(1, Number(x.maxPersons) || 1),
      invitedAt: new Date().toISOString(),
      openedAt: null,
      rsvp: { status: 'pending', persons: 0, note: '', respondedAt: null },
    }));
    db.guests.push(...created);
    persist();
    return clone(created);
  }],
  ['PATCH', '/guests/:id', async (ctx) => {
    const w = requireWedding(ctx);
    const g = db.guests.find((x) => x.id === ctx.params.id && x.weddingId === w.id);
    if (!g) fail(404, 'Gost nije pronađen.');
    const { name, email, phone, side, maxPersons, rsvp } = ctx.body || {};
    if (name !== undefined && !String(name).trim()) fail(422, 'Ime gosta je obavezno.');
    Object.assign(g, Object.fromEntries(Object.entries({ name, email, phone, side }).filter(([, v]) => v !== undefined)));
    if (maxPersons !== undefined) g.maxPersons = Math.max(1, Number(maxPersons) || 1);
    if (rsvp) g.rsvp = { ...g.rsvp, ...rsvp, respondedAt: new Date().toISOString() };
    persist();
    return clone(g);
  }],
  ['DELETE', '/guests/:id', async (ctx) => {
    const w = requireWedding(ctx);
    const i = db.guests.findIndex((x) => x.id === ctx.params.id && x.weddingId === w.id);
    if (i < 0) fail(404, 'Gost nije pronađen.');
    db.guests.splice(i, 1);
    persist();
    return { id: ctx.params.id };
  }],

  ['GET', '/weddings/:id/photos', async (ctx) => {
    requireWedding(ctx, ctx.params.id);
    return clone(db.photos.filter((p) => p.weddingId === ctx.params.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }],
  ['PATCH', '/photos/:id', async (ctx) => {
    const w = requireWedding(ctx);
    const p = db.photos.find((x) => x.id === ctx.params.id && x.weddingId === w.id);
    if (!p) fail(404, 'Fotografija nije pronađena.');
    if (!['pending', 'approved', 'hidden'].includes(ctx.body?.status)) fail(422, 'Nepoznat status.');
    p.status = ctx.body.status;
    persist();
    return clone(p);
  }],
  ['POST', '/weddings/:id/photos/bulk-status', async (ctx) => {
    requireWedding(ctx, ctx.params.id);
    const { ids = [], status } = ctx.body || {};
    const updated = db.photos.filter((p) => ids.includes(p.id));
    updated.forEach((p) => { p.status = status; });
    persist();
    return clone(updated);
  }],
  ['DELETE', '/photos/:id', async (ctx) => {
    const w = requireWedding(ctx);
    const i = db.photos.findIndex((x) => x.id === ctx.params.id && x.weddingId === w.id);
    if (i < 0) fail(404, 'Fotografija nije pronađena.');
    db.photos.splice(i, 1);
    persist();
    return { id: ctx.params.id };
  }],

  ['GET', '/weddings/:id/design-requests', async (ctx) => {
    requireWedding(ctx, ctx.params.id);
    return clone(db.designRequests.filter((r) => r.weddingId === ctx.params.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }],
  ['POST', '/weddings/:id/design-requests', async (ctx) => {
    requireWedding(ctx, ctx.params.id);
    const b = ctx.body || {};
    if (!b.description?.trim()) fail(422, 'Opišite šta želite.');
    const account = userFromToken(ctx.token);
    if (!account.phone) fail(422, 'Dodajte broj telefona na nalog da bi dizajner mogao da vas kontaktira.');
    const r = {
      id: uid('dr'),
      weddingId: ctx.params.id,
      type: b.type || 'album',
      style: b.style || '',
      pages: b.pages || null,
      budget: b.budget || '',
      description: b.description.trim(),
      includePrint: !!b.includePrint,
      status: 'received',
      createdAt: new Date().toISOString(),
      designerNote: '',
      contactPhone: account.phone,
    };
    db.designRequests.push(r);
    persist();
    return clone(r);
  }],

  ['GET', '/public/invitations/:token', async (ctx) => {
    const g = guestByToken(ctx.params.token);
    const w = db.weddings.find((x) => x.id === g.weddingId);
    return {
      guest: { name: g.name, maxPersons: g.maxPersons, rsvp: g.rsvp, token: g.token },
      wedding: publicWedding(w),
    };
  }],
  ['POST', '/public/invitations/:token/opened', async (ctx) => {
    const g = guestByToken(ctx.params.token);
    if (!g.openedAt) {
      g.openedAt = new Date().toISOString();
      persist();
    }
    return { ok: true };
  }],
  ['POST', '/public/invitations/:token/rsvp', async (ctx) => {
    const g = guestByToken(ctx.params.token);
    const { status, persons, note } = ctx.body || {};
    if (!['yes', 'no'].includes(status)) fail(422, 'Izaberite da li dolazite.');
    const n = status === 'yes' ? Number(persons) : 0;
    if (status === 'yes' && (n < 1 || n > g.maxPersons)) fail(422, `Broj osoba mora biti između 1 i ${g.maxPersons}.`);
    g.rsvp = { status, persons: n, note: note || '', respondedAt: new Date().toISOString() };
    persist();
    return { rsvp: g.rsvp };
  }],
  ['POST', '/public/invitations/:token/photos', async (ctx) => {
    const g = guestByToken(ctx.params.token);
    const w = db.weddings.find((x) => x.id === g.weddingId);
    return savePhotos(w, g, ctx.body, ctx.onUploadProgress);
  }],
  ['GET', '/public/weddings/:slug', async (ctx) => {
    const w = db.weddings.find((x) => x.slug === ctx.params.slug);
    if (!w) fail(404, 'Venčanje nije pronađeno.');
    return publicWedding(w);
  }],
  ['POST', '/public/weddings/:slug/photos', async (ctx) => {
    const w = db.weddings.find((x) => x.slug === ctx.params.slug);
    if (!w) fail(404, 'Venčanje nije pronađeno.');
    if (!w.settings.allowGeneralUpload) fail(403, 'Mladenci su isključili slanje slika preko QR koda.');
    return savePhotos(w, null, ctx.body, ctx.onUploadProgress);
  }],

  ['POST', '/__mock/reset', async () => {
    const { sessions } = db;
    resetDb();
    db.sessions = sessions;
    persist();
    return { ok: true };
  }],
];

const compiled = routes.map(([method, path, handler]) => {
  const keys = [];
  const re = new RegExp(`^${path.replace(/:([a-zA-Z]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; })}$`);
  return { method, re, keys, handler };
});

export async function mockRequest({ method, url, data, params, onUploadProgress, token }) {
  await latency();
  syncFromStorage();
  const path = url.split('?')[0];
  for (const r of compiled) {
    if (r.method !== method) continue;
    const m = path.match(r.re);
    if (!m) continue;
    const routeParams = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
    const result = await r.handler({ params: routeParams, body: data, query: params, token, onUploadProgress });
    if (import.meta.env.DEV) console.debug('[mock]', method, url, data instanceof FormData ? '(FormData)' : data ?? '', '→', result);
    return result;
  }
  fail(404, `Mock: ruta ${method} ${path} ne postoji`);
}
