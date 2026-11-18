/**
 * Mock baza – živi u memoriji i čuva se u localStorage, pa izmene prežive refresh.
 * Reset: localStorage.removeItem('uspomena-mock-db-v2') ili dugme u Podešavanjima.
 * v2: demo venčanje ima 100 gostiju i 100 odobrenih slika (+ nekoliko na čekanju/skrivenih).
 */
import { placeholderPhoto } from '../utils/placeholder';

const KEY = 'uspomena-mock-db-v2';

export const uid = (prefix = 'id') => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
export const token = () => Math.random().toString(36).slice(2, 7) + Math.random().toString(36).slice(2, 5);

const daysAgo = (d) => new Date(Date.now() - d * 86400000).toISOString();

/** mali deterministički PRNG – seed je uvek isti, pa reset daje iste podatke */
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

/** 88 dodatnih gostiju (uz 12 ručno upisanih) – parovi, porodice, rodbina, prijatelji */
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
  const guests = guestsSeed.map(([name, tok, side, maxPersons, status, persons, note], i) => ({
    id: `g_${i + 1}`,
    weddingId,
    name,
    token: tok,
    email: '',
    phone: '',
    side,
    maxPersons,
    invitedAt: daysAgo(20),
    openedAt: status !== 'pending' || i % 3 === 0 ? daysAgo(10 - (i % 5)) : null,
    rsvp: { status, persons, note, respondedAt: status === 'pending' ? null : daysAgo(8 - (i % 4)) },
  }));

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

  // ko šalje slike: gosti koji dolaze (i Luka koji ne može, ali šalje), neki šalju mnogo, većina po 1–3
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
  // 100 odobrenih + 6 na čekanju + 2 skrivene (da i moderacija ima šta da prikaže)
  const statusFor = (i) => (i < 100 ? 'approved' : i < 106 ? 'pending' : 'hidden');
  const photos = Array.from({ length: 108 }, (_, i) => {
    // prvih nekoliko pošiljalaca garantovano ima slike, ostalo po težinama
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
    users: [{ id: 'u_demo', email: 'demo@uspomena.rs', password: 'demo123', name: 'Ana i Marko', phone: '+381641234567', weddingId }],
    sessions: {},
    weddings: [
      {
        id: weddingId,
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
          galleryUnlockAfterWedding: true,
          allowGeneralUpload: true,
        },
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

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* localStorage nedostupan – radimo samo u memoriji */
  }
  return seed();
}

export const db = load();

/** Ponovo čita localStorage – da se vide izmene iz drugog taba (npr. gost poslao sliku) */
let storageOk = true;
export function syncFromStorage() {
  if (!storageOk) return; // posle punog localStorage-a važi samo memorija
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const fresh = JSON.parse(raw);
    Object.keys(db).forEach((k) => delete db[k]);
    Object.assign(db, fresh);
  } catch {
    /* ignore */
  }
}

export function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    storageOk = false;
    // pun localStorage (puno uploadovanih slika) – podaci ostaju u memoriji do refresha
  }
}

export function resetDb() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  const fresh = seed();
  Object.keys(db).forEach((k) => delete db[k]);
  Object.assign(db, fresh);
  persist();
}
