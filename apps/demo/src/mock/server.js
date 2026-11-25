import { db, persist, uid, token as newToken, resetDb, syncFromStorage } from './db';
import { normalizePhone } from '../utils/phone';
import { translateMessage } from './messages';
import { cleanNames, companionsFromMaxPersons, galleryOpensAt, isEmail, isGalleryOpen, maxCompanions } from '../utils/gallery';

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
const fail = (status, key, params) => {
  throw new ApiError(key, status, { key, params });
};
const clone = (x) => JSON.parse(JSON.stringify(x));

const userFromToken = (tok) => {
  const userId = db.sessions[tok];
  const user = db.users.find((u) => u.id === userId);
  if (!user || user.active === false) fail(401, 'sessionExpired');
  return user;
};
const requireAdmin = (ctx) => {
  const user = userFromToken(ctx.token);
  if (user.role !== 'superadmin') fail(403, 'adminOnly');
  return user;
};
const requireWedding = (ctx, weddingId) => {
  const user = userFromToken(ctx.token);
  if (weddingId && user.weddingId !== weddingId) fail(403, 'noAccess');
  const wedding = db.weddings.find((w) => w.id === user.weddingId);
  if (!wedding) fail(404, 'weddingNotFound');
  return wedding;
};
const publicUser = (u) => ({ id: u.id, role: u.role || 'couple', email: u.email, name: u.name, phone: u.phone || '', weddingId: u.weddingId });

const newPassword = () => {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};
const coupleById = (id) => {
  const user = db.users.find((u) => u.id === id && u.role !== 'superadmin');
  if (!user) fail(404, 'accountNotFound');
  return user;
};
const endSessions = (userId) => {
  Object.keys(db.sessions).forEach((k) => {
    if (db.sessions[k] === userId) delete db.sessions[k];
  });
};
const adminAccount = (u) => {
  const w = db.weddings.find((x) => x.id === u.weddingId);
  return {
    ...publicUser(u),
    active: u.active !== false,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt || null,
    wedding: w ? { id: w.id, type: w.type || 'wedding', occasion: w.occasion || '', slug: w.slug, partner1: w.partner1, partner2: w.partner2, date: w.date } : null,
    stats: {
      guests: db.guests.filter((g) => g.weddingId === u.weddingId).length,
      photos: db.photos.filter((p) => p.weddingId === u.weddingId).length,
    },
  };
};
const parseAccount = (b, current) => {
  const type = (b.type ?? current?.wedding?.type) === 'celebration' ? 'celebration' : 'wedding';
  const occasion = type === 'celebration' ? String(b.occasion ?? current?.wedding?.occasion ?? '').trim() : '';
  const email = String(b.email ?? current?.email ?? '').toLowerCase().trim();
  const partner1 = String(b.partner1 ?? current?.wedding?.partner1 ?? '').trim();
  const partner2 = type === 'celebration' ? '' : String(b.partner2 ?? current?.wedding?.partner2 ?? '').trim();
  const date = String(b.date ?? current?.wedding?.date ?? '');
  const phone = normalizePhone(b.phone ?? current?.phone);
  if (!/^\S+@\S+\.\S+$/.test(email)) fail(422, 'invalidEmail');
  if (type === 'celebration' && !partner1) fail(422, 'celebrantRequired');
  if (type === 'wedding' && (!partner1 || !partner2)) fail(422, 'namesRequired');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail(422, type === 'celebration' ? 'celebrationDateRequired' : 'dateRequired');
  if (!phone) fail(422, 'invalidPhone');
  if (db.users.some((u) => u.email.toLowerCase() === email && u.id !== current?.id)) fail(409, 'emailTaken');
  return { type, occasion, email, partner1, partner2, date, phone };
};

const slugFor = (a, b, sep = '-i-') => {
  const base = `${a}${b ? sep + b : ''}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'dj').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 34) || 'vencanje';
  let slug = base;
  for (let i = 2; db.weddings.some((w) => w.slug === slug); i++) slug = `${base}-${i}`;
  return slug;
};
const publicWedding = (w) => ({
  type: w.type || 'wedding',
  occasion: w.occasion || '',
  slug: w.slug,
  partner1: w.partner1,
  partner2: w.partner2,
  date: w.date,
  rsvpDeadline: w.rsvpDeadline,
  city: w.city,
  invitation: w.invitation,
  settings: { allowGeneralUpload: w.settings.allowGeneralUpload },
  gallery: { open: isGalleryOpen(w), mode: w.settings.galleryOpen, opensAt: galleryOpensAt(w), viaQr: !!w.settings.galleryViaQr },
});
const guestByToken = (tok) => {
  const g = db.guests.find((x) => x.token === tok);
  if (!g) fail(404, 'invitationNotFound');
  return g;
};
const weddingBySlug = (slug) => {
  const w = db.weddings.find((x) => x.slug === slug);
  if (!w) fail(404, 'weddingNotFound');
  return w;
};

const parseCompanions = (input, maxPersons) => {
  if (!input) return companionsFromMaxPersons(maxPersons);
  const type = ['none', 'open', 'named'].includes(input.type) ? input.type : 'none';
  if (type === 'named') {
    const names = cleanNames(input.names);
    if (!names.length) fail(422, 'namedCompanionRequired');
    if (names.length > 19) fail(422, 'tooManyCompanions');
    return { type, max: names.length, names };
  }
  if (type === 'open') {
    const max = Number(input.max);
    if (!Number.isInteger(max) || max < 1 || max > 19) fail(422, 'companionsRange');
    return { type, max, names: [] };
  }
  return { type: 'none', max: 0, names: [] };
};

const parseRsvp = (guest, body, { manual = false } = {}) => {
  const { status, note } = body || {};
  const valid = manual ? ['yes', 'no', 'pending'] : ['yes', 'no'];
  if (!valid.includes(status)) fail(422, 'chooseAttendance');
  if (status !== 'yes') return { status, persons: 0, companions: [], note: note ?? guest.rsvp.note ?? '' };
  const c = guest.companions;
  let companions = cleanNames(body.companions);
  let persons;
  if (c.type === 'named') {
    if (companions.some((n) => !c.names.includes(n))) fail(422, 'companionNotInvited');
    companions = c.names.filter((n) => companions.includes(n));
    persons = 1 + companions.length;
  } else {
    const max = maxCompanions(guest);
    persons = Number(body.persons) || 1;
    if (persons < 1 || persons > max + 1) fail(422, 'personsRange', { max: max + 1 });
    if (companions.length > persons - 1) fail(422, 'moreNamesThanPersons');
  }
  return { status, persons, companions, note: note ?? '' };
};

const emptyNotify = () => ({ email: '', requestedAt: null, sentAt: null });

const newGuest = (weddingId, b) => {
  const companions = parseCompanions(b.companions, b.maxPersons);
  return {
    id: uid('g'),
    weddingId,
    name: b.name.trim(),
    token: newToken(),
    email: b.email || '',
    phone: b.phone || '',
    side: b.side || 'zajednicki',
    companions,
    maxPersons: 1 + maxCompanions({ companions }),
    invitedAt: new Date().toISOString(),
    openedAt: null,
    rsvp: { status: 'pending', persons: 0, companions: [], note: '', respondedAt: null },
    photoNotify: emptyNotify(),
  };
};

const publicGuest = (g) => ({
  name: g.name,
  token: g.token,
  maxPersons: g.maxPersons,
  companions: g.companions,
  rsvp: g.rsvp,
  notifyEmail: g.photoNotify?.email || '',
  prefillEmail: g.photoNotify?.email || g.email || '',
});

const publicGallery = (w, viaQr) => {
  if (viaQr && !w.settings.galleryViaQr) fail(403, 'galleryPersonalOnly');
  const open = isGalleryOpen(w);
  return {
    open,
    mode: w.settings.galleryOpen,
    opensAt: galleryOpensAt(w),
    photos: open
      ? db.photos
        .filter((p) => p.weddingId === w.id && p.status === 'approved')
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((p) => ({ id: p.id, url: p.url, senderName: p.senderName, message: p.message, category: p.category, createdAt: p.createdAt }))
      : [],
  };
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
  if (!files.length) fail(400, 'noFiles');
  if (files.length > 50) fail(400, 'tooManyFiles');
  const created = [];
  for (let i = 0; i < files.length; i += 1) {
    const f = files[i];
    if (!f.type?.startsWith('image/')) fail(400, 'notImage', { name: f.name });
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
    if (!user || user.password !== body?.password) fail(401, 'badCredentials');
    if (user.active === false) fail(403, 'accountDisabled');
    user.lastLoginAt = new Date().toISOString();
    const tok = `mock_${newToken()}`;
    db.sessions[tok] = user.id;
    persist();
    return { token: tok, user: publicUser(user) };
  }],
  ['GET', '/auth/me', async (ctx) => ({ user: publicUser(userFromToken(ctx.token)) })],
  ['PATCH', '/auth/me', async (ctx) => {
    const user = userFromToken(ctx.token);
    const { name, phone } = ctx.body || {};
    if (phone !== undefined) {
      const clean = normalizePhone(phone);
      if (!clean) fail(422, 'invalidPhone');
      user.phone = clean;
    }
    if (name !== undefined && String(name).trim()) user.name = String(name).trim();
    persist();
    return { user: publicUser(user) };
  }],

  ['GET', '/admin/accounts', async (ctx) => {
    requireAdmin(ctx);
    return db.users
      .filter((u) => u.role !== 'superadmin')
      .map(adminAccount)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }],
  ['POST', '/admin/accounts', async (ctx) => {
    requireAdmin(ctx);
    const b = ctx.body || {};
    const { type, occasion, email, partner1, partner2, date, phone } = parseAccount(b);
    const celebration = type === 'celebration';
    const password = String(b.password || '').trim() || newPassword();
    if (password.length < 6) fail(422, 'passwordTooShort');
    const wedding = {
      id: uid('w'),
      type,
      occasion,
      slug: celebration ? slugFor(partner1, occasion || 'proslava', '-') : slugFor(partner1, partner2),
      partner1,
      partner2,
      date,
      rsvpDeadline: '',
      city: '',
      invitation: {
        templateId: 'klasik',
        accentColor: '#2D4A3E',
        headline: celebration
          ? `sa radošću vas pozivam na ${occasion ? occasion.charAt(0).toLowerCase() + occasion.slice(1) : 'proslavu'}`
          : 'sa radošću vas pozivamo na naše venčanje',
        message: '',
        schedule: [{ id: uid('e'), time: celebration ? '20:00' : '17:00', title: celebration ? 'Proslava' : 'Svečana večera', place: '', mapUrl: '' }],
      },
      settings: { autoApprovePhotos: false, allowGeneralUpload: true, galleryOpen: 'after_wedding', galleryManualOpen: false, galleryViaQr: true },
      photoSubscribers: [],
    };
    const user = { id: uid('u'), role: 'couple', email, password, name: celebration ? partner1 : `${partner1} i ${partner2}`, phone, weddingId: wedding.id, active: true, createdAt: new Date().toISOString(), lastLoginAt: null };
    db.weddings.push(wedding);
    db.users.push(user);
    persist();
    return { account: adminAccount(user), password };
  }],
  ['PATCH', '/admin/accounts/:id', async (ctx) => {
    requireAdmin(ctx);
    const user = coupleById(ctx.params.id);
    const b = ctx.body || {};
    const { type, occasion, email, partner1, partner2, date, phone } = parseAccount(b, adminAccount(user));
    user.email = email;
    user.phone = phone;
    user.name = type === 'celebration' ? partner1 : `${partner1} i ${partner2}`;
    const w = db.weddings.find((x) => x.id === user.weddingId);
    if (w) Object.assign(w, { type, occasion, partner1, partner2, date });
    if (b.active !== undefined) {
      user.active = !!b.active;
      if (!user.active) endSessions(user.id);
    }
    persist();
    return adminAccount(user);
  }],
  ['POST', '/admin/accounts/:id/password', async (ctx) => {
    requireAdmin(ctx);
    const user = coupleById(ctx.params.id);
    const password = String(ctx.body?.password || '').trim() || newPassword();
    if (password.length < 6) fail(422, 'passwordTooShort');
    user.password = password;
    endSessions(user.id);
    persist();
    return { password };
  }],
  ['DELETE', '/admin/accounts/:id', async (ctx) => {
    requireAdmin(ctx);
    const user = coupleById(ctx.params.id);
    const wid = user.weddingId;
    endSessions(user.id);
    db.users = db.users.filter((u) => u.id !== user.id);
    db.weddings = db.weddings.filter((w) => w.id !== wid);
    db.guests = db.guests.filter((g) => g.weddingId !== wid);
    db.photos = db.photos.filter((p) => p.weddingId !== wid);
    db.designRequests = db.designRequests.filter((r) => r.weddingId !== wid);
    persist();
    return { ok: true };
  }],

  ['GET', '/weddings/current', async (ctx) => clone(requireWedding(ctx))],
  ['PATCH', '/weddings/:id', async (ctx) => {
    const w = requireWedding(ctx, ctx.params.id);
    const { slug, partner1, partner2, occasion, date, rsvpDeadline, city, invitation, settings } = ctx.body || {};
    if (slug !== undefined) {
      const clean = String(slug).toLowerCase().trim();
      if (!/^[a-z0-9-]{3,40}$/.test(clean)) fail(422, 'badSlug');
      w.slug = clean;
    }
    Object.assign(w, Object.fromEntries(Object.entries({ partner1, partner2: w.type === 'celebration' ? undefined : partner2, occasion: w.type === 'celebration' ? occasion : undefined, date, rsvpDeadline, city }).filter(([, v]) => v !== undefined)));
    if (invitation) w.invitation = { ...w.invitation, ...invitation };
    if (settings) {
      if (settings.galleryOpen !== undefined && !['now', 'after_wedding', 'manual'].includes(settings.galleryOpen)) fail(422, 'badGalleryMode');
      w.settings = { ...w.settings, ...settings };
    }
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
    if (!b.name?.trim()) fail(422, 'guestNameRequired');
    const g = newGuest(ctx.params.id, b);
    db.guests.push(g);
    persist();
    return clone(g);
  }],
  ['POST', '/weddings/:id/guests/import', async (ctx) => {
    requireWedding(ctx, ctx.params.id);
    const list = Array.isArray(ctx.body?.guests) ? ctx.body.guests : [];
    const created = list.filter((x) => x.name?.trim()).map((x) => newGuest(ctx.params.id, x));
    db.guests.push(...created);
    persist();
    return clone(created);
  }],
  ['PATCH', '/guests/:id', async (ctx) => {
    const w = requireWedding(ctx);
    const g = db.guests.find((x) => x.id === ctx.params.id && x.weddingId === w.id);
    if (!g) fail(404, 'guestNotFound');
    const { name, email, phone, side, companions, rsvp } = ctx.body || {};
    if (name !== undefined && !String(name).trim()) fail(422, 'guestNameRequired');
    Object.assign(g, Object.fromEntries(Object.entries({ name, email, phone, side }).filter(([, v]) => v !== undefined)));
    if (companions !== undefined) {
      g.companions = parseCompanions(companions);
      g.maxPersons = 1 + maxCompanions(g);
      if (!rsvp && g.rsvp.status === 'yes') {
        const keep = g.companions.type === 'named'
          ? g.rsvp.companions.filter((n) => g.companions.names.includes(n))
          : g.rsvp.companions.slice(0, g.companions.max);
        const persons = g.companions.type === 'named' ? 1 + keep.length : Math.min(g.rsvp.persons, g.maxPersons);
        g.rsvp = { ...g.rsvp, companions: keep.slice(0, persons - 1), persons };
      }
    }
    if (rsvp) {
      const parsed = parseRsvp(g, rsvp, { manual: true });
      g.rsvp = { ...parsed, respondedAt: parsed.status === 'pending' ? null : new Date().toISOString() };
    }
    persist();
    return clone(g);
  }],
  ['DELETE', '/guests/:id', async (ctx) => {
    const w = requireWedding(ctx);
    const i = db.guests.findIndex((x) => x.id === ctx.params.id && x.weddingId === w.id);
    if (i < 0) fail(404, 'guestNotFound');
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
    if (!p) fail(404, 'photoNotFound');
    if (!['pending', 'approved', 'hidden'].includes(ctx.body?.status)) fail(422, 'badStatus');
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
    if (i < 0) fail(404, 'photoNotFound');
    db.photos.splice(i, 1);
    persist();
    return { id: ctx.params.id };
  }],

  ['POST', '/weddings/:id/photo-notifications', async (ctx) => {
    const w = requireWedding(ctx, ctx.params.id);
    if (!isGalleryOpen(w)) fail(409, 'galleryClosed');
    const sentAt = new Date().toISOString();
    const guests = db.guests.filter((g) => g.weddingId === w.id && g.photoNotify?.email && !g.photoNotify.sentAt);
    guests.forEach((g) => { g.photoNotify.sentAt = sentAt; });
    const subscribers = w.settings.galleryViaQr ? (w.photoSubscribers || []).filter((x) => !x.sentAt) : [];
    subscribers.forEach((x) => { x.sentAt = sentAt; });
    persist();
    return { sent: guests.length + subscribers.length, sentAt, guestIds: guests.map((g) => g.id), subscriberIds: subscribers.map((x) => x.id) };
  }],

  ['GET', '/weddings/:id/design-requests', async (ctx) => {
    requireWedding(ctx, ctx.params.id);
    return clone(db.designRequests.filter((r) => r.weddingId === ctx.params.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }],
  ['POST', '/weddings/:id/design-requests', async (ctx) => {
    requireWedding(ctx, ctx.params.id);
    const b = ctx.body || {};
    if (!b.description?.trim()) fail(422, 'describeRequest');
    const account = userFromToken(ctx.token);
    if (!account.phone) fail(422, 'phoneRequiredForDesigner');
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
    return { guest: publicGuest(g), wedding: publicWedding(w) };
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
    g.rsvp = { ...parseRsvp(g, ctx.body), respondedAt: new Date().toISOString() };
    persist();
    return { rsvp: g.rsvp };
  }],
  ['POST', '/public/invitations/:token/notify', async (ctx) => {
    const g = guestByToken(ctx.params.token);
    const email = String(ctx.body?.email || '').trim().toLowerCase();
    if (!isEmail(email)) fail(422, 'invalidEmail');
    const changed = g.photoNotify?.email !== email;
    g.photoNotify = { email, requestedAt: new Date().toISOString(), sentAt: changed ? null : g.photoNotify.sentAt };
    persist();
    return { notifyEmail: email };
  }],
  ['GET', '/public/invitations/:token/gallery', async (ctx) => {
    const g = guestByToken(ctx.params.token);
    return publicGallery(db.weddings.find((x) => x.id === g.weddingId), false);
  }],
  ['POST', '/public/invitations/:token/photos', async (ctx) => {
    const g = guestByToken(ctx.params.token);
    const w = db.weddings.find((x) => x.id === g.weddingId);
    return savePhotos(w, g, ctx.body, ctx.onUploadProgress);
  }],
  ['GET', '/public/weddings/:slug', async (ctx) => publicWedding(weddingBySlug(ctx.params.slug))],
  ['GET', '/public/weddings/:slug/gallery', async (ctx) => publicGallery(weddingBySlug(ctx.params.slug), true)],
  ['POST', '/public/weddings/:slug/notify', async (ctx) => {
    const w = weddingBySlug(ctx.params.slug);
    if (!w.settings.galleryViaQr) fail(403, 'galleryPersonalOnly');
    const email = String(ctx.body?.email || '').trim().toLowerCase();
    if (!isEmail(email)) fail(422, 'invalidEmail');
    w.photoSubscribers = w.photoSubscribers || [];
    if (!w.photoSubscribers.some((x) => x.email === email)) {
      w.photoSubscribers.push({ id: uid('ps'), email, name: String(ctx.body?.name || '').trim(), createdAt: new Date().toISOString(), sentAt: null });
      persist();
    }
    return { notifyEmail: email };
  }],
  ['POST', '/public/weddings/:slug/photos', async (ctx) => {
    const w = weddingBySlug(ctx.params.slug);
    if (!w.settings.allowGeneralUpload) fail(403, 'qrUploadDisabled');
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

export async function mockRequest(args) {
  try {
    return await handleRequest(args);
  } catch (err) {
    if (err instanceof ApiError && err.data?.key) {
      const message = translateMessage(err.data.key, err.data.params, args.lang);
      throw new ApiError(message, err.status, { message });
    }
    throw err;
  }
}

async function handleRequest({ method, url, data, params, onUploadProgress, token }) {
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
  fail(404, 'routeNotFound', { method, path });
}
