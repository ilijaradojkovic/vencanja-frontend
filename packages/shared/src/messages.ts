/**
 * User-facing API error messages in Serbian, English and Russian, ported from
 * the prototype's `src/mock/messages.js` (SPEC §3.2). Keys are the `code` of the
 * `{ message, code, requestId, traceId }` error envelope; every response is
 * rendered in the language from `Accept-Language` (SYS-6).
 *
 * Mock-only and cut-feature keys from the prototype (`routeNotFound`,
 * `phoneRequiredForDesigner`, `describeRequest`) are intentionally not ported.
 */

export const LANGUAGES = ['sr', 'en', 'ru'] as const;
export type Language = (typeof LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = 'sr';

export type MessageParams = Record<string, string | number>;

const MESSAGES = {
  badRequest: {
    sr: 'Neispravan zahtev.',
    en: 'Invalid request.',
    ru: 'Неверный запрос.',
  },
  unauthorized: {
    sr: 'Morate biti prijavljeni.',
    en: 'You must be signed in.',
    ru: 'Необходимо войти в аккаунт.',
  },
  forbidden: {
    sr: 'Nemate dozvolu za ovu radnju.',
    en: 'You are not allowed to do this.',
    ru: 'У вас нет прав на это действие.',
  },
  notFound: {
    sr: 'Traženi resurs nije pronađen.',
    en: 'The requested resource was not found.',
    ru: 'Запрашиваемый ресурс не найден.',
  },
  conflict: {
    sr: 'Radnja nije moguća u trenutnom stanju.',
    en: 'This action is not possible in the current state.',
    ru: 'Действие невозможно в текущем состоянии.',
  },
  tooManyRequests: {
    sr: 'Previše pokušaja, pokušajte ponovo za koji trenutak.',
    en: 'Too many attempts, please try again shortly.',
    ru: 'Слишком много попыток, попробуйте немного позже.',
  },
  internalError: {
    sr: 'Došlo je do greške. Pokušajte ponovo.',
    en: 'Something went wrong. Please try again.',
    ru: 'Произошла ошибка. Попробуйте ещё раз.',
  },
  noFiles: {
    sr: 'Niste izabrali nijednu fotografiju.',
    en: 'You have not selected any photos.',
    ru: 'Вы не выбрали ни одной фотографии.',
  },
  tooManyFiles: {
    sr: 'Najviše 50 fotografija odjednom.',
    en: 'At most 50 photos at once.',
    ru: 'Не более 50 фото за раз.',
  },
  tooLarge: {
    sr: '{{name}} je veća od {{max}} MB.',
    en: '{{name}} is larger than {{max}} MB.',
    ru: '{{name}} больше {{max}} МБ.',
  },
  storageLimit: {
    sr: 'Dostignut je limit za skladištenje fotografija ovog naloga.',
    en: 'This account has reached its photo storage limit.',
    ru: 'Достигнут лимит хранилища фотографий этого аккаунта.',
  },
  uploadNotFound: {
    sr: 'Fotografija nije stigla na skladište. Pokušajte ponovo.',
    en: 'The photo did not reach storage. Please try again.',
    ru: 'Фотография не попала в хранилище. Попробуйте ещё раз.',
  },
  notImage: {
    sr: '{{name}} nije slika.',
    en: '{{name}} is not an image.',
    ru: '{{name}} — не изображение.',
  },
  badCredentials: {
    sr: 'Pogrešan email ili lozinka.',
    en: 'Wrong email or password.',
    ru: 'Неверный email или пароль.',
  },
  sessionExpired: {
    sr: 'Sesija je istekla, prijavite se ponovo.',
    en: 'Your session has expired, please log in again.',
    ru: 'Сессия истекла, войдите снова.',
  },
  galleryPersonalOnly: {
    sr: 'Galerija je dostupna samo preko ličnih linkova gostiju.',
    en: 'The gallery is only available via guests’ personal links.',
    ru: 'Галерея доступна только по личным ссылкам гостей.',
  },
  qrUploadDisabled: {
    sr: 'Mladenci su isključili slanje slika preko QR koda.',
    en: 'The couple has turned off photo uploads via the QR code.',
    ru: 'Молодожёны отключили загрузку фото по QR-коду.',
  },
  noAccess: {
    sr: 'Nemate pristup ovom venčanju.',
    en: 'You do not have access to this wedding.',
    ru: 'У вас нет доступа к этой свадьбе.',
  },
  photoNotFound: {
    sr: 'Fotografija nije pronađena.',
    en: 'Photo not found.',
    ru: 'Фото не найдено.',
  },
  guestNotFound: {
    sr: 'Gost nije pronađen.',
    en: 'Guest not found.',
    ru: 'Гость не найден.',
  },
  invitationNotFound: {
    sr: 'Pozivnica nije pronađena. Proverite link.',
    en: 'Invitation not found. Please check the link.',
    ru: 'Приглашение не найдено. Проверьте ссылку.',
  },
  weddingNotFound: {
    sr: 'Venčanje nije pronađeno.',
    en: 'Wedding not found.',
    ru: 'Свадьба не найдена.',
  },
  galleryClosed: {
    sr: 'Galerija još nije otvorena za goste. Otvorite je u podešavanjima pa pošaljite obaveštenje.',
    en: 'The gallery is not open to guests yet. Open it in settings, then send the notification.',
    ru: 'Галерея ещё не открыта для гостей. Откройте её в настройках, а затем отправьте уведомление.',
  },
  emailTaken: {
    sr: 'Nalog sa ovim emailom već postoji.',
    en: 'An account with this email already exists.',
    ru: 'Аккаунт с таким email уже существует.',
  },
  badSlug: {
    sr: 'Adresa može imati samo mala slova, brojeve i crtice (3–40 znakova).',
    en: 'The address may only contain lowercase letters, numbers and hyphens (3–40 characters).',
    ru: 'Адрес может содержать только строчные латинские буквы, цифры и дефисы (3–40 символов).',
  },
  companionsRange: {
    sr: 'Broj pratilaca mora biti između 1 i 19.',
    en: 'The number of companions must be between 1 and 19.',
    ru: 'Количество спутников должно быть от 1 до 19.',
  },
  guestNameRequired: {
    sr: 'Ime gosta je obavezno.',
    en: 'Guest name is required.',
    ru: 'Имя гостя обязательно.',
  },
  chooseAttendance: {
    sr: 'Izaberite da li dolazite.',
    en: 'Please choose whether you are attending.',
    ru: 'Выберите, придёте ли вы.',
  },
  passwordTooShort: {
    sr: 'Lozinka mora imati bar 6 znakova.',
    en: 'The password must be at least 6 characters.',
    ru: 'Пароль должен содержать не менее 6 символов.',
  },
  tooManyCompanions: {
    sr: 'Najviše 19 pratilaca.',
    en: 'At most 19 companions.',
    ru: 'Не более 19 спутников.',
  },
  badTemplate: {
    sr: 'Nepoznat izgled pozivnice.',
    en: 'Unknown invitation template.',
    ru: 'Неизвестный шаблон приглашения.',
  },
  badColor: {
    sr: 'Boja mora biti u formatu #RRGGBB.',
    en: 'The color must be in the #RRGGBB format.',
    ru: 'Цвет должен быть в формате #RRGGBB.',
  },
  badSchedule: {
    sr: 'Proverite vremena i nazive u rasporedu.',
    en: 'Check the times and titles in the schedule.',
    ru: 'Проверьте время и названия в расписании.',
  },
  tooManyScheduleItems: {
    sr: 'Najviše 20 stavki u rasporedu.',
    en: 'At most 20 schedule items.',
    ru: 'Не более 20 пунктов расписания.',
  },
  badSettings: {
    sr: 'Nepoznata podešavanja.',
    en: 'Unknown settings.',
    ru: 'Неизвестные настройки.',
  },
  tooManyGuests: {
    sr: 'Najviše 1000 gostiju u jednom uvozu.',
    en: 'At most 1000 guests per import.',
    ru: 'Не более 1000 гостей за один импорт.',
  },
  badSide: {
    sr: 'Nepoznata strana gosta.',
    en: 'Unknown guest side.',
    ru: 'Неизвестная сторона гостя.',
  },
  badDeadline: {
    sr: 'Datum za potvrde nije ispravan.',
    en: 'The RSVP deadline is not a valid date.',
    ru: 'Неверная дата подтверждения.',
  },
  textTooLong: {
    sr: 'Tekst je predugačak (najviše {{max}} znakova).',
    en: 'The text is too long (at most {{max}} characters).',
    ru: 'Текст слишком длинный (не более {{max}} символов).',
  },
  badGalleryMode: {
    sr: 'Nepoznat način otvaranja galerije.',
    en: 'Unknown gallery opening mode.',
    ru: 'Неизвестный режим открытия галереи.',
  },
  badStatus: {
    sr: 'Nepoznat status.',
    en: 'Unknown status.',
    ru: 'Неизвестный статус.',
  },
  companionNotInvited: {
    sr: 'Pratilac nije na spisku pozvanih.',
    en: 'This companion is not on the invited list.',
    ru: 'Этого спутника нет в списке приглашённых.',
  },
  dateRequired: {
    sr: 'Unesite datum venčanja.',
    en: 'Enter the wedding date.',
    ru: 'Укажите дату свадьбы.',
  },
  namesRequired: {
    sr: 'Unesite imena mladenaca.',
    en: "Enter the couple's names.",
    ru: 'Укажите имена молодожёнов.',
  },
  invalidEmail: {
    sr: 'Unesite ispravan email.',
    en: 'Enter a valid email.',
    ru: 'Введите правильный email.',
  },
  namedCompanionRequired: {
    sr: 'Upišite bar jedno ime pratioca.',
    en: 'Enter at least one companion name.',
    ru: 'Укажите хотя бы одно имя спутника.',
  },
  moreNamesThanPersons: {
    sr: 'Više imena pratilaca nego osoba koje dolaze.',
    en: 'More companion names than people coming.',
    ru: 'Имён спутников больше, чем придёт человек.',
  },
  invalidPhone: {
    sr: 'Unesite ispravan broj telefona, npr. 064 123 4567.',
    en: 'Enter a valid phone number, e.g. +381 64 123 4567.',
    ru: 'Введите правильный номер телефона, например +381 64 123 4567.',
  },
  accountDisabled: {
    sr: 'Nalog je deaktiviran. Javite se administratoru.',
    en: 'This account has been deactivated. Please contact the administrator.',
    ru: 'Аккаунт деактивирован. Обратитесь к администратору.',
  },
  accountNotFound: {
    sr: 'Nalog nije pronađen.',
    en: 'Account not found.',
    ru: 'Аккаунт не найден.',
  },
  adminOnly: {
    sr: 'Ovo je dostupno samo superadminu.',
    en: 'This is available to the superadmin only.',
    ru: 'Это доступно только суперадмину.',
  },
  celebrantRequired: {
    sr: 'Unesite ime slavljenika.',
    en: "Enter the guest of honour's name.",
    ru: 'Укажите имя виновника торжества.',
  },
  celebrationDateRequired: {
    sr: 'Unesite datum proslave.',
    en: 'Enter the celebration date.',
    ru: 'Укажите дату праздника.',
  },
  personsRange: {
    sr: 'Broj osoba mora biti između 1 i {{max}}.',
    en: 'The number of people must be between 1 and {{max}}.',
    ru: 'Количество человек должно быть от 1 до {{max}}.',
  },
  onboardingRequired: {
    sr: 'Prvo dovršite podešavanje naloga.',
    en: 'Finish setting up your account first.',
    ru: 'Сначала завершите настройку аккаунта.',
  },
  passwordMismatch: {
    sr: 'Lozinke se ne poklapaju.',
    en: 'The passwords do not match.',
    ru: 'Пароли не совпадают.',
  },
  termsRequired: {
    sr: 'Prihvatite uslove korišćenja i politiku privatnosti.',
    en: 'Please accept the terms of use and the privacy policy.',
    ru: 'Примите условия использования и политику конфиденциальности.',
  },
  cityTooLong: {
    sr: 'Naziv grada je predugačak.',
    en: 'The city name is too long.',
    ru: 'Название города слишком длинное.',
  },
  nameRequired: {
    sr: 'Unesite ime.',
    en: 'Enter a name.',
    ru: 'Введите имя.',
  },
  nameTooLong: {
    sr: 'Ime je predugačko (najviše 120 znakova).',
    en: 'The name is too long (at most 120 characters).',
    ru: 'Имя слишком длинное (не более 120 символов).',
  },
} as const satisfies Record<string, Record<Language, string>>;

export type MessageKey = keyof typeof MESSAGES;

export const MESSAGE_KEYS = Object.keys(MESSAGES) as MessageKey[];

/**
 * Turns an `Accept-Language` header into a supported language. Unknown or
 * missing values fall back to Serbian, matching the prototype (SYS-6).
 */
export const parseLanguage = (acceptLanguage?: string | null): Language => {
  const candidate = String(acceptLanguage ?? '')
    .trim()
    .slice(0, 2)
    .toLowerCase();
  return (LANGUAGES as readonly string[]).includes(candidate) ? (candidate as Language) : DEFAULT_LANGUAGE;
};

const interpolate = (template: string, params: MessageParams): string =>
  template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => String(params[key] ?? ''));

export const translateMessage = (key: MessageKey, params: MessageParams = {}, acceptLanguage?: string | null): string =>
  interpolate(MESSAGES[key][parseLanguage(acceptLanguage)], params);
