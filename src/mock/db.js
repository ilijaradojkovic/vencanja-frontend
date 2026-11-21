import { placeholderPhoto } from '../utils/placeholder';
import { companionsFromMaxPersons } from '../utils/gallery';

const KEY = 'uspomena-mock-db-v3';
const OLD_KEYS = ['uspomena-mock-db-v2'];

export const uid = (prefix = 'id') => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
export const token = () => Math.random().toString(36).slice(2, 7) + Math.random().toString(36).slice(2, 5);

const daysAgo = (d) => new Date(Date.now() - d * 86400000).toISOString();

function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ['Ana', 'Milan', 'Jovana', 'Nikola', 'Marija', 'Stefan', 'Teodora', 'Lazar', 'Sara', 'Vuk', 'Mina', 'Filip', 'Katarina', 'Uroš',
  'Tamara', 'Dušan', 'Jelena', 'Aleksa', 'Nina', 'Bojan', 'Sanja', 'Pavle', 'Ivana', 'Miloš', 'Dragana', 'Ognjen', 'Tijana', 'Nenad', 'Maja', 'Strahinja',
  'Andrea', 'Đorđe', 'Isidora', 'Vladimir', 'Kristina', 'Relja', 'Snežana', 'Goran', 'Vesna', 'Zoran', 'Ljiljana', 'Dejan', 'Mirjana', 'Igor'];
const LAST = ['Petrović', 'Nikolić', 'Jovanović', 'Đorđević', 'Ilić', 'Pavlović', 'Marković', 'Stojanović', 'Popović', 'Kostić', 'Živković', 'Tomić',
  'Savić', 'Lazić', 'Milošević', 'Stanković', 'Ristić', 'Mitrović', 'Kovačević', 'Todorović', 'Simić', 'Radovanović', 'Vasić', 'Obradović'];
const RELATIVE = ['Tetka', 'Teča', 'Ujak', 'Ujna', 'Stric', 'Strina', 'Kuma', 'Kum', 'Deda', 'Baka', 'Sestra', 'Brat', 'Bratanac', 'Sestrična'];

function extraGuests(count) {
  const rnd = prng(2027);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const used = new Set();
  const out = [];
  while (out.length < count) {
    const kind = rnd();
    let name;
    let maxPersons;
    if (kind < 0.32) { name = `${pick(FIRST)} i ${pick(FIRST)}`; maxPersons = 2; }
    else if (kind < 0.5) { name = `Porodica ${pick(LAST)}`; maxPersons = 3 + Math.floor(rnd() * 3); }
    else if (kind < 0.66) { name = `${pick(RELATIVE)} ${pick(FIRST)}`; maxPersons = 1 + Math.floor(rnd() * 2); }
    else { name = `${pick(FIRST)} ${pick(LAST)}`; maxPersons = rnd() < 0.6 ? 1 : 2; }
    if (used.has(name)) continue;
    used.add(name);
    const r = rnd();
    const status = r < 0.68 ? 'yes' : r < 0.8 ? 'no' : 'pending';
    const persons = status === 'yes' ? Math.max(1, maxPersons - (rnd() < 0.25 ? 1 : 0)) : 0;
    const notes = ['', '', '', '', 'Bez glutena, molim', 'Jedno dete do 5 godina', 'Vegetarijanska večera', 'Dolazimo kasnije, posle 20h', 'Pesma: Lepa Brena – Čačak, Čačak'];
    const tok = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'dj').replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '').slice(0, 22);
    out.push([name, `${tok}-${out.length + 13}`, pick(['mlada', 'mladozenja', 'zajednicki']), maxPersons, status, persons, status === 'yes' ? pick(notes) : '']);
  }
  return out;
}

function seed() {
  const weddingId = 'w_demo';
  const guestsSeed = [
    ['Jelena i Nikola', 'demo-jelena', 'zajednicki', 2, 'yes', 2, 'Jedno vegetarijansko jelo'],
    ['Porodica Petrović', 'petrovic', 'mlada', 4, 'yes', 4, ''],
    ['Milica Jovanović', 'milica', 'mlada', 1, 'pending', 0, ''],
    ['Stefan i Teodora', 'stefan', 'mladozenja', 2, 'yes', 2, ''],
    ['Kum Vladimir', 'kum', 'mladozenja', 3, 'yes', 3, 'Pesma: Đorđe Balašević – Ne lomite mi bagrenje'],
    ['Tetka Snežana', 'snezana', 'mlada', 2, 'pending', 0, ''],
    ['Luka Marković', 'luka', 'mladozenja', 1, 'no', 0, 'Na putu sam, šaljem slike!'],
    ['Ivana i Đorđe', 'ivana', 'zajednicki', 2, 'pending', 0, ''],
    ['Baka Ljubica', 'baka', 'mlada', 1, 'yes', 1, ''],
    ['Porodica Ilić', 'ilic', 'mladozenja', 5, 'yes', 4, 'Dvoje dece do 10 godina'],
    ['Nemanja Stojanović', 'nemanja', 'zajednicki', 2, 'pending', 0, ''],
    ['Kolege iz firme', 'kolege', 'mladozenja', 6, 'yes', 5, ''],
    ...extraGuests(88),
  ];
  const named = {
    petrovic: ['Dragan', 'Vesna', 'Luka'],
    stefan: ['Teodora'],
    ilic: ['Zoran', 'Maja', 'Sofija', 'Đorđe'],
  };
  const companionNames = { kum: ['Jasna', 'Pavle'], 'demo-jelena': ['Nikola'] };
  const notify = {
    'demo-jelena': 'jelena@example.com',
    petrovic: 'vesna.petrovic@example.com',
    kum: 'vladimir.kum@example.com',
    baka: '',
    luka: 'luka.markovic@example.com',
  };
  const guests = guestsSeed.map(([name, tok, side, maxPersons, status, persons, note], i) => {
    const companions = named[tok]
      ? { type: 'named', max: named[tok].length, names: named[tok] }
      : companionsFromMaxPersons(maxPersons);
    const coming = status !== 'yes' ? [] : named[tok] ? named[tok].slice(0, persons - 1) : (companionNames[tok] || []).slice(0, persons - 1);
    const email = notify[tok] || (i % 7 === 3 ? `gost${i + 1}@example.com` : '');
    return {
      id: `g_${i + 1}`,
      weddingId,
      name,
      token: tok,
      email,
      phone: i % 4 === 0 ? `+38164${String(1000000 + i * 7919).slice(0, 7)}` : '',
      side,
      maxPersons: 1 + (companions.type === 'named' ? companions.names.length : companions.max),
      companions,
      invitedAt: daysAgo(20),
      openedAt: status !== 'pending' || i % 3 === 0 ? daysAgo(10 - (i % 5)) : null,
      rsvp: { status, persons, companions: coming, note, respondedAt: status === 'pending' ? null : daysAgo(8 - (i % 4)) },
      photoNotify: notify[tok] ? { email: notify[tok], requestedAt: daysAgo(7), sentAt: null } : { email: '', requestedAt: null, sentAt: null },
    };
  });

  const msgs = [
    'Kopaonik 2019 – tada smo znali da će ovo biti nešto ozbiljno!',
    'Najlepša mlada, bez diskusije.',
    'Ovo je sa Markovog 18. rođendana, ne pitajte.',
    '', '', '',
    'Volimo vas!',
    'Kolo u 3 ujutru se računa kao sport.',
    'Neka vam svaki dan bude kao ovaj.',
    'Ana je plakala već na „uzimam“ 😭',
    'Najbolja svadba ove godine, bez konkurencije.',
    'Sa maturske, sećate se?',
    'Kum je opet bio glavni na podijumu.',
    'Mama Markova u akciji!',
    'Prvi ples – svi smo zanemeli.',
    'Torta je bila savršena.',
    'Leto na Adi, 2021.',
    'Hvala vam što smo bili deo ovoga ❤',
  ];

  const rnd = prng(612);
  const senders = guests.filter((g) => g.rsvp.status === 'yes' || g.id === 'g_7').slice(0, 45);
  const weights = senders.map((g, i) => (['g_1', 'g_5', 'g_2'].includes(g.id) ? 6 : i < 12 ? 3 : 1 + rnd() * 1.5));
  const total = weights.reduce((x, y) => x + y, 0);
  const pickSender = () => {
    let r = rnd() * total;
    for (let i = 0; i < senders.length; i++) {
      r -= weights[i];
      if (r <= 0) return senders[i];
    }
    return senders[senders.length - 1];
  };
  const statusFor = (i) => (i < 100 ? 'approved' : i < 106 ? 'pending' : 'hidden');
  const photos = Array.from({ length: 108 }, (_, i) => {
    const g = i < senders.length ? senders[i] : pickSender();
    return {
      id: `p_${i + 1}`,
      weddingId,
      guestId: g.id,
      senderName: g.name,
      category: rnd() < 0.28 ? 'memories' : 'wedding',
      message: msgs[Math.floor(rnd() * msgs.length)],
      status: statusFor(i),
      url: placeholderPhoto(i + 1),
      createdAt: daysAgo(15 - (i % 15) - rnd()),
    };
  });

  return {
    users: [
      { id: 'u_admin', role: 'superadmin', email: 'admin@uspomena.rs', password: 'admin123', name: 'Superadmin', phone: '', weddingId: null, active: true, createdAt: daysAgo(120), lastLoginAt: null },
      { id: 'u_demo', role: 'couple', email: 'demo@uspomena.rs', password: 'demo123', name: 'Ana i Marko', phone: '+381641234567', weddingId, active: true, createdAt: daysAgo(40), lastLoginAt: daysAgo(1) },
    ],
    sessions: {},
    weddings: [
      {
        id: weddingId,
        type: 'wedding',
        occasion: '',
        slug: 'ana-i-marko',
        partner1: 'Ana',
        partner2: 'Marko',
        date: '2027-06-12',
        rsvpDeadline: '2027-05-01',
        city: 'Beograd',
        invitation: {
          templateId: 'klasik',
          accentColor: '#2D4A3E',
          headline: 'sa radošću vas pozivamo na naše venčanje',
          message: 'Bilo bi nam drago da ovaj dan provedete sa nama. Vaše prisustvo je za nas najlepši poklon.',
          schedule: [
            { id: 'e1', time: '15:00', title: 'Crkveno venčanje', place: '[Naziv crkve], Beograd', mapUrl: '' },
            { id: 'e2', time: '17:00', title: 'Građansko i svečana večera', place: '[Naziv sale], Beograd', mapUrl: '' },
          ],
        },
        settings: {
          autoApprovePhotos: false,
          allowGeneralUpload: true,
          galleryOpen: 'after_wedding',
          galleryManualOpen: false,
          galleryViaQr: true,
        },
        photoSubscribers: [
          { id: 'ps_1', email: 'drugarica.sa.faksa@example.com', name: 'Mina', createdAt: daysAgo(3), sentAt: null },
          { id: 'ps_2', email: 'fotograf.amater@example.com', name: '', createdAt: daysAgo(2), sentAt: null },
        ],
      },
    ],
    guests,
    photos,
    designRequests: [
      {
        id: 'dr_1',
        weddingId,
        type: 'invitation',
        style: 'Romantičan, klasičan',
        pages: null,
        budget: '50–100 €',
        description: 'Akvarel ilustracija crkve na naslovnoj strani pozivnice.',
        includePrint: false,
        status: 'in_progress',
        createdAt: daysAgo(6),
        designerNote: 'Prva skica stiže u petak.',
      },
    ],
  };
}

const celebrationDemo = () => {
  const wid = 'w_luka';
  const people = [
    ['Porodica Nikolić', 'luka-nikolic', 'mlada', 4, 'yes', 3],
    ['Kum Bojan', 'luka-bojan', 'mladozenja', 2, 'yes', 2],
    ['Drugari iz razreda', 'luka-razred', 'mladozenja', 12, 'pending', 0],
    ['Baka Mira', 'luka-baka', 'mlada', 1, 'yes', 1],
    ['Tetka Vesna', 'luka-tetka', 'mlada', 2, 'no', 0],
  ];
  return {
    user: { id: 'u_luka', role: 'couple', email: 'rodjendan@uspomena.rs', password: 'demo123', name: 'Luka', phone: '+381601112233', weddingId: wid, active: true, createdAt: daysAgo(10), lastLoginAt: null },
    wedding: {
      id: wid,
      type: 'celebration',
      occasion: '18. rođendan',
      slug: 'luka-18-rodjendan',
      partner1: 'Luka',
      partner2: '',
      date: '2027-03-20',
      rsvpDeadline: '2027-03-01',
      city: 'Novi Sad',
      invitation: {
        templateId: 'noc',
        accentColor: '#C9A96E',
        headline: 'sa radošću vas pozivam na 18. rođendan',
        message: 'Punoletstvo se slavi jednom. Dođite da ga proslavimo zajedno!',
        schedule: [{ id: 'e1', time: '20:00', title: 'Proslava', place: '[Naziv kluba], Novi Sad', mapUrl: '' }],
      },
      settings: { autoApprovePhotos: false, allowGeneralUpload: true, galleryOpen: 'after_wedding', galleryManualOpen: false, galleryViaQr: true },
      photoSubscribers: [],
    },
    guests: people.map(([name, tok, side, maxPersons, status, persons], i) => ({
      id: `g_luka_${i + 1}`,
      weddingId: wid,
      name,
      token: tok,
      email: '',
      phone: '',
      side,
      companions: companionsFromMaxPersons(maxPersons),
      maxPersons,
      invitedAt: daysAgo(9),
      openedAt: status === 'pending' ? null : daysAgo(5),
      rsvp: { status, persons, companions: [], note: '', respondedAt: status === 'pending' ? null : daysAgo(4) },
      photoNotify: { email: '', requestedAt: null, sentAt: null },
    })),
  };
};

function migrate(data) {
  data.users.forEach((u) => {
    u.role = u.role || 'couple';
    if (u.active === undefined) u.active = true;
    u.createdAt = u.createdAt || new Date().toISOString();
    if (u.lastLoginAt === undefined) u.lastLoginAt = null;
  });
  data.weddings.forEach((w) => {
    w.type = w.type || 'wedding';
    if (w.occasion === undefined) w.occasion = '';
  });
  if (!data.celebrationDemoSeeded) {
    data.celebrationDemoSeeded = true;
    const demo = celebrationDemo();
    data.users.push(demo.user);
    data.weddings.push(demo.wedding);
    data.guests.push(...demo.guests);
  }
  if (!data.users.some((u) => u.role === 'superadmin')) {
    data.users.unshift({ id: 'u_admin', role: 'superadmin', email: 'admin@uspomena.rs', password: 'admin123', name: 'Superadmin', phone: '', weddingId: null, active: true, createdAt: new Date().toISOString(), lastLoginAt: null });
  }
  return data;
}

function load() {
  try {
    OLD_KEYS.forEach((k) => localStorage.removeItem(k));
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch {
  }
  return migrate(seed());
}

export const db = load();

let storageOk = true;
export function syncFromStorage() {
  if (!storageOk) return;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const fresh = migrate(JSON.parse(raw));
    Object.keys(db).forEach((k) => delete db[k]);
    Object.assign(db, fresh);
  } catch {
  }
}

export function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    storageOk = false;
  }
}

export function resetDb() {
  try {
    localStorage.removeItem(KEY);
  } catch {
  }
  const fresh = migrate(seed());
  Object.keys(db).forEach((k) => delete db[k]);
  Object.assign(db, fresh);
  persist();
}
