import type { CompanionSet } from '@uspomena/shared';

/**
 * Deterministic local seed fixtures (LOCAL_DEVELOPMENT.md §3).
 *
 * Everything here is local-only: `.test` email addresses, documented disposable
 * passwords and fixed UUIDs. Nothing may be reused in Preview or Production.
 */
export const SEED_PASSWORDS = {
  admin: 'admin-local-123',
  couple: 'couple-local-123',
  celebration: 'celebration-local-123',
  newOrganizer: 'new-organizer-local-123',
  unconfirmed: 'unconfirmed-local-123',
  google: 'google-local-123',
  inactive: 'inactive-local-123',
  retention30: 'retention-30-local-123',
  retention7: 'retention-7-local-123',
  archived: 'archived-local-123',
  storageLimit: 'storage-limit-local-123',
} as const;

const uuid = (suffix: string): string => `5eed0000-0000-4000-8000-${suffix.padStart(12, '0')}`;

export const SEED_USER_IDS = {
  admin: uuid('1'),
  couple: uuid('2'),
  celebration: uuid('3'),
  newOrganizer: uuid('4'),
  unconfirmed: uuid('5'),
  google: uuid('6'),
  inactive: uuid('7'),
  retention30: uuid('8'),
  retention7: uuid('9'),
  archived: uuid('10'),
  storageLimit: uuid('11'),
} as const;

export const SEED_EVENT_IDS = {
  wedding: uuid('101'),
  celebration: uuid('102'),
  inactive: uuid('103'),
  retention30: uuid('104'),
  retention7: uuid('105'),
  archived: uuid('106'),
  storageLimit: uuid('107'),
} as const;

export type SeedUser = {
  key: keyof typeof SEED_USER_IDS;
  email: string;
  password: string;
  role: 'superadmin' | 'couple';
  name: string;
  phone: string;
  locale: 'sr' | 'en' | 'ru';
  active: boolean;
  emailConfirmed: boolean;
  onboarded: boolean;
  googleLinked: boolean;
  profile: boolean;
};

type UserInput = {
  key: SeedUser['key'];
  email: string;
  password: string;
  role?: SeedUser['role'];
  name: string;
  phone?: string;
  locale?: SeedUser['locale'];
  active?: boolean;
  emailConfirmed?: boolean;
  onboarded?: boolean;
  googleLinked?: boolean;
  profile?: boolean;
};

const user = (input: UserInput): SeedUser => ({
  key: input.key,
  email: input.email,
  password: input.password,
  role: input.role ?? 'couple',
  name: input.name,
  phone: input.phone ?? '+381641234567',
  locale: input.locale ?? 'sr',
  active: input.active ?? true,
  emailConfirmed: input.emailConfirmed ?? true,
  onboarded: input.onboarded ?? true,
  googleLinked: input.googleLinked ?? false,
  profile: input.profile ?? true,
});

export const SEED_USERS: readonly SeedUser[] = [
  user({
    key: 'admin',
    email: 'admin@uspomena.test',
    password: SEED_PASSWORDS.admin,
    role: 'superadmin',
    name: 'Superadmin',
    phone: '',
  }),
  user({ key: 'couple', email: 'couple@uspomena.test', password: SEED_PASSWORDS.couple, name: 'Ana i Marko' }),
  user({
    key: 'celebration',
    email: 'celebration@uspomena.test',
    password: SEED_PASSWORDS.celebration,
    name: 'Luka',
  }),
  user({
    key: 'newOrganizer',
    email: 'new-organizer@uspomena.test',
    password: SEED_PASSWORDS.newOrganizer,
    name: 'Nova organizatorka',
    onboarded: false,
  }),
  user({
    key: 'unconfirmed',
    email: 'unconfirmed@uspomena.test',
    password: SEED_PASSWORDS.unconfirmed,
    name: 'Nepotvrđeni nalog',
    emailConfirmed: false,
    onboarded: false,
    profile: false,
  }),
  user({
    key: 'google',
    email: 'google@uspomena.test',
    password: SEED_PASSWORDS.google,
    name: 'Google organizator',
    googleLinked: true,
    onboarded: false,
  }),
  user({
    key: 'inactive',
    email: 'inactive@uspomena.test',
    password: SEED_PASSWORDS.inactive,
    name: 'Deaktiviran nalog',
    active: false,
  }),
  user({
    key: 'retention30',
    email: 'retention-30@uspomena.test',
    password: SEED_PASSWORDS.retention30,
    name: 'Retention 30',
  }),
  user({
    key: 'retention7',
    email: 'retention-7@uspomena.test',
    password: SEED_PASSWORDS.retention7,
    name: 'Retention 7',
  }),
  user({
    key: 'archived',
    email: 'archived@uspomena.test',
    password: SEED_PASSWORDS.archived,
    name: 'Arhivirana proslava',
  }),
  user({
    key: 'storageLimit',
    email: 'storage-limit@uspomena.test',
    password: SEED_PASSWORDS.storageLimit,
    name: 'Storage limit',
  }),
];

export type SeedEvent = {
  key: keyof typeof SEED_EVENT_IDS;
  owner: SeedUser['key'];
  type: 'wedding' | 'celebration';
  occasion: string;
  slug: string;
  partner1: string;
  partner2: string;
  /** Fixed date for the demo events; retention events compute it from today. */
  date: string | null;
  city: string;
  retentionMonths: number;
  /** Days to add to `date` for retention fixtures, or null for the stored date. */
  purgeAfterDays: number | null;
  purgeWarned30: boolean;
  purgeWarned7: boolean;
  purged: boolean;
  storageLimitBytes: number | null;
  settings?: Partial<{
    autoApprovePhotos: boolean;
    allowGeneralUpload: boolean;
    galleryOpen: 'now' | 'after_wedding' | 'manual';
    galleryManualOpen: boolean;
    galleryViaQr: boolean;
  }>;
};

export const DEFAULT_SETTINGS = {
  autoApprovePhotos: false,
  allowGeneralUpload: true,
  galleryOpen: 'after_wedding' as const,
  galleryManualOpen: false,
  galleryViaQr: true,
};

export const DEFAULT_INVITATION = {
  templateId: 'klasik',
  accentColor: '#2D4A3E',
  headline: 'Venčavamo se',
  message: 'Sa radošću vas pozivamo da podelite naš dan sa nama.',
  schedule: [
    { time: '16:00', title: 'Okupljanje gostiju' },
    { time: '17:00', title: 'Ceremonija' },
    { time: '19:00', title: 'Večera i slavlje' },
  ],
};

export type SeedGuest = {
  id: string;
  name: string;
  token: string;
  side: 'mlada' | 'mladozenja' | 'zajednicki';
  companions: CompanionSet;
  rsvpStatus: 'pending' | 'yes' | 'no';
  rsvpPersons: number;
  rsvpCompanions: string[];
  rsvpNote: string;
  email: string;
  notify: { email: string; locale: 'sr' | 'en' | 'ru'; requested: boolean; sent: boolean } | null;
};

const named = (names: string[]): CompanionSet => ({ type: 'named', max: names.length, names });
const open = (max: number): CompanionSet => ({ type: 'open', max, names: [] });
const none: CompanionSet = { type: 'none', max: 0, names: [] };

/** Wedding guests covering every RSVP, companion and notification state. */
export const SEED_GUESTS: readonly SeedGuest[] = [
  {
    id: uuid('201'),
    name: 'Jelena Petrović',
    token: 'seedguest001',
    side: 'zajednicki',
    companions: named(['Nikola']),
    rsvpStatus: 'pending',
    rsvpPersons: 0,
    rsvpCompanions: [],
    rsvpNote: '',
    email: 'jelena@uspomena.test',
    notify: null,
  },
  {
    id: uuid('202'),
    name: 'Porodica Petrović',
    token: 'seedguest002',
    side: 'mlada',
    companions: named(['Dragan', 'Vesna', 'Luka']),
    rsvpStatus: 'yes',
    rsvpPersons: 4,
    rsvpCompanions: ['Dragan', 'Vesna', 'Luka'],
    rsvpNote: 'Dvoje dece do 10 godina',
    email: 'petrovic@uspomena.test',
    notify: { email: 'petrovic@uspomena.test', locale: 'sr', requested: true, sent: false },
  },
  {
    id: uuid('203'),
    name: 'Milica Jovanović',
    token: 'seedguest003',
    side: 'mlada',
    companions: open(1),
    rsvpStatus: 'pending',
    rsvpPersons: 0,
    rsvpCompanions: [],
    rsvpNote: '',
    email: '',
    notify: null,
  },
  {
    id: uuid('204'),
    name: 'Kum Vladimir',
    token: 'seedguest004',
    side: 'mladozenja',
    companions: open(2),
    rsvpStatus: 'yes',
    rsvpPersons: 3,
    rsvpCompanions: ['Jasna', 'Pavle'],
    rsvpNote: 'Pesma: Đorđe Balašević – Ne lomite mi bagrenje',
    email: 'kum@uspomena.test',
    notify: { email: 'kum@uspomena.test', locale: 'en', requested: true, sent: true },
  },
  {
    id: uuid('205'),
    name: 'Luka Marković',
    token: 'seedguest005',
    side: 'mladozenja',
    companions: none,
    rsvpStatus: 'no',
    rsvpPersons: 0,
    rsvpCompanions: [],
    rsvpNote: 'Na putu sam, šaljem slike!',
    email: '',
    notify: null,
  },
  {
    id: uuid('206'),
    name: 'Baka Ljubica',
    token: 'seedguest006',
    side: 'mlada',
    companions: none,
    rsvpStatus: 'yes',
    rsvpPersons: 1,
    rsvpCompanions: [],
    rsvpNote: '',
    email: '',
    notify: null,
  },
  {
    id: uuid('207'),
    name: 'Kolege iz firme',
    token: 'seedguest007',
    side: 'zajednicki',
    companions: open(5),
    rsvpStatus: 'yes',
    rsvpPersons: 5,
    rsvpCompanions: [],
    rsvpNote: '',
    email: 'kolege@uspomena.test',
    notify: null,
  },
];

export type SeedPhoto = {
  id: string;
  senderName: string;
  category: 'memories' | 'wedding';
  message: string;
  status: 'uploading' | 'pending' | 'approved' | 'hidden';
  format: 'jpeg' | 'png' | 'webp';
  /** Declared size for reservations; real files are generated at seed time. */
  sizeBytes: number;
  guestId: string | null;
  files: boolean;
  color: { r: number; g: number; b: number };
};

export const SEED_PHOTOS: readonly SeedPhoto[] = [
  {
    id: uuid('301'),
    senderName: 'Jelena Petrović',
    category: 'wedding',
    message: 'Prvi ples',
    status: 'approved',
    format: 'jpeg',
    sizeBytes: 0,
    guestId: uuid('201'),
    files: true,
    color: { r: 210, g: 180, b: 140 },
  },
  {
    id: uuid('302'),
    senderName: 'Porodica Petrović',
    category: 'wedding',
    message: 'Uz tortu',
    status: 'approved',
    format: 'png',
    sizeBytes: 0,
    guestId: uuid('202'),
    files: true,
    color: { r: 180, g: 200, b: 170 },
  },
  {
    id: uuid('303'),
    senderName: 'Kum Vladimir',
    category: 'memories',
    message: 'Stara slika sa Kopaonika',
    status: 'approved',
    format: 'webp',
    sizeBytes: 0,
    guestId: uuid('204'),
    files: true,
    color: { r: 150, g: 160, b: 190 },
  },
  {
    id: uuid('304'),
    senderName: 'Milica Jovanović',
    category: 'wedding',
    message: 'Čeka odobrenje',
    status: 'pending',
    format: 'jpeg',
    sizeBytes: 0,
    guestId: uuid('203'),
    files: true,
    color: { r: 220, g: 200, b: 180 },
  },
  {
    id: uuid('305'),
    senderName: 'Porodica Petrović',
    category: 'wedding',
    message: 'Sakrivena',
    status: 'hidden',
    format: 'jpeg',
    sizeBytes: 0,
    guestId: uuid('202'),
    files: true,
    color: { r: 120, g: 100, b: 90 },
  },
  {
    id: uuid('306'),
    senderName: 'Milica Jovanović',
    category: 'wedding',
    message: '',
    status: 'uploading',
    format: 'jpeg',
    sizeBytes: 900_000,
    guestId: uuid('203'),
    files: false,
    color: { r: 60, g: 60, b: 60 },
  },
];

/** Real files in local Storage for the storage-limit event (2 MB budget). */
export const SEED_LIMIT_PHOTOS: readonly SeedPhoto[] = [
  {
    id: uuid('401'),
    senderName: 'Storage limit',
    category: 'wedding',
    message: 'Zauzima prostor 1',
    status: 'approved',
    format: 'png',
    sizeBytes: 0,
    guestId: null,
    files: true,
    color: { r: 90, g: 130, b: 180 },
  },
  {
    id: uuid('402'),
    senderName: 'Storage limit',
    category: 'wedding',
    message: 'Zauzima prostor 2',
    status: 'approved',
    format: 'png',
    sizeBytes: 0,
    guestId: null,
    files: true,
    color: { r: 180, g: 120, b: 90 },
  },
];

export const SEED_SUBSCRIBERS: readonly {
  id: string;
  email: string;
  name: string;
  locale: 'sr' | 'en' | 'ru';
  sent: boolean;
}[] = [
  { id: uuid('501'), email: 'qr-gost@uspomena.test', name: 'QR gost', locale: 'sr', sent: false },
  { id: uuid('502'), email: 'qr-gost-en@uspomena.test', name: 'QR guest', locale: 'en', sent: true },
];

export const SEED_EVENTS: readonly SeedEvent[] = [
  {
    key: 'wedding',
    owner: 'couple',
    type: 'wedding',
    occasion: '',
    slug: 'ana-i-marko',
    partner1: 'Ana',
    partner2: 'Marko',
    date: '2026-11-14',
    city: 'Beograd',
    retentionMonths: 3,
    purgeAfterDays: null,
    purgeWarned30: false,
    purgeWarned7: false,
    purged: false,
    storageLimitBytes: 50_000_000,
  },
  {
    key: 'celebration',
    owner: 'celebration',
    type: 'celebration',
    occasion: '18. rođendan',
    slug: 'luka-18-rodjendan',
    partner1: 'Luka',
    partner2: '',
    date: '2026-12-05',
    city: 'Novi Sad',
    retentionMonths: 3,
    purgeAfterDays: null,
    purgeWarned30: false,
    purgeWarned7: false,
    purged: false,
    storageLimitBytes: 50_000_000,
    settings: { galleryOpen: 'manual', galleryManualOpen: true, allowGeneralUpload: false },
  },
  {
    key: 'inactive',
    owner: 'inactive',
    type: 'wedding',
    occasion: '',
    slug: 'deaktiviran-nalog',
    partner1: 'Ivana',
    partner2: 'Đorđe',
    date: '2026-10-01',
    city: 'Niš',
    retentionMonths: 3,
    purgeAfterDays: null,
    purgeWarned30: false,
    purgeWarned7: false,
    purged: false,
    storageLimitBytes: 50_000_000,
  },
  {
    key: 'retention30',
    owner: 'retention30',
    type: 'wedding',
    occasion: '',
    slug: 'retention-30',
    partner1: 'Mila',
    partner2: 'Nikola',
    date: null,
    city: 'Kragujevac',
    retentionMonths: 1,
    purgeAfterDays: 30,
    purgeWarned30: false,
    purgeWarned7: false,
    purged: false,
    storageLimitBytes: 50_000_000,
  },
  {
    key: 'retention7',
    owner: 'retention7',
    type: 'celebration',
    occasion: 'Punoljetstvo',
    slug: 'retention-7',
    partner1: 'Petar',
    partner2: '',
    date: null,
    city: 'Subotica',
    retentionMonths: 1,
    purgeAfterDays: 7,
    purgeWarned30: true,
    purgeWarned7: false,
    purged: false,
    storageLimitBytes: 50_000_000,
  },
  {
    key: 'archived',
    owner: 'archived',
    type: 'wedding',
    occasion: '',
    slug: 'arhivirano-vencanje',
    partner1: 'Jovana',
    partner2: 'Stefan',
    date: null,
    city: 'Čačak',
    retentionMonths: 1,
    purgeAfterDays: -1,
    purgeWarned30: true,
    purgeWarned7: true,
    purged: true,
    storageLimitBytes: 50_000_000,
  },
  {
    key: 'storageLimit',
    owner: 'storageLimit',
    type: 'wedding',
    occasion: '',
    slug: 'storage-limit',
    partner1: 'Sara',
    partner2: 'Vuk',
    date: '2026-11-20',
    city: 'Beograd',
    retentionMonths: 3,
    purgeAfterDays: null,
    purgeWarned30: false,
    purgeWarned7: false,
    purged: false,
    storageLimitBytes: 2_000_000,
  },
];
