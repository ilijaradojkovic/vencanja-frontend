const MESSAGES = {
  noFiles: ['Niste izabrali nijednu fotografiju.', 'You have not selected any photos.', 'Вы не выбрали ни одной фотографии.'],
  tooManyFiles: ['Najviše 50 fotografija odjednom.', 'At most 50 photos at once.', 'Не более 50 фото за раз.'],
  notImage: ['{{name}} nije slika.', '{{name}} is not an image.', '{{name}} — не изображение.'],
  badCredentials: ['Pogrešan email ili lozinka.', 'Wrong email or password.', 'Неверный email или пароль.'],
  sessionExpired: ['Sesija je istekla, prijavite se ponovo.', 'Your session has expired, please log in again.', 'Сессия истекла, войдите снова.'],
  galleryPersonalOnly: ['Galerija je dostupna samo preko ličnih linkova gostiju.', 'The gallery is only available via guests’ personal links.', 'Галерея доступна только по личным ссылкам гостей.'],
  qrUploadDisabled: ['Mladenci su isključili slanje slika preko QR koda.', 'The couple has turned off photo uploads via the QR code.', 'Молодожёны отключили загрузку фото по QR-коду.'],
  noAccess: ['Nemate pristup ovom venčanju.', 'You do not have access to this wedding.', 'У вас нет доступа к этой свадьбе.'],
  photoNotFound: ['Fotografija nije pronađena.', 'Photo not found.', 'Фото не найдено.'],
  guestNotFound: ['Gost nije pronađen.', 'Guest not found.', 'Гость не найден.'],
  invitationNotFound: ['Pozivnica nije pronađena. Proverite link.', 'Invitation not found. Please check the link.', 'Приглашение не найдено. Проверьте ссылку.'],
  weddingNotFound: ['Venčanje nije pronađeno.', 'Wedding not found.', 'Свадьба не найдена.'],
  routeNotFound: ['Mock: ruta {{method}} {{path}} ne postoji', 'Mock: route {{method}} {{path}} does not exist', 'Mock: маршрут {{method}} {{path}} не существует'],
  galleryClosed: [
    'Galerija još nije otvorena za goste. Otvorite je u podešavanjima pa pošaljite obaveštenje.',
    'The gallery is not open to guests yet. Open it in settings, then send the notification.',
    'Галерея ещё не открыта для гостей. Откройте её в настройках, а затем отправьте уведомление.',
  ],
  emailTaken: ['Nalog sa ovim emailom već postoji.', 'An account with this email already exists.', 'Аккаунт с таким email уже существует.'],
  badSlug: [
    'Adresa može imati samo mala slova, brojeve i crtice (3–40 znakova).',
    'The address may only contain lowercase letters, numbers and hyphens (3–40 characters).',
    'Адрес может содержать только строчные латинские буквы, цифры и дефисы (3–40 символов).',
  ],
  companionsRange: ['Broj pratilaca mora biti između 1 i 19.', 'The number of companions must be between 1 and 19.', 'Количество спутников должно быть от 1 до 19.'],
  phoneRequiredForDesigner: [
    'Dodajte broj telefona na nalog da bi dizajner mogao da vas kontaktira.',
    'Add a phone number to your account so the designer can contact you.',
    'Добавьте номер телефона в аккаунт, чтобы дизайнер мог с вами связаться.',
  ],
  guestNameRequired: ['Ime gosta je obavezno.', 'Guest name is required.', 'Имя гостя обязательно.'],
  chooseAttendance: ['Izaberite da li dolazite.', 'Please choose whether you are attending.', 'Выберите, придёте ли вы.'],
  passwordTooShort: ['Lozinka mora imati bar 6 znakova.', 'The password must be at least 6 characters.', 'Пароль должен содержать не менее 6 символов.'],
  tooManyCompanions: ['Najviše 19 pratilaca.', 'At most 19 companions.', 'Не более 19 спутников.'],
  badGalleryMode: ['Nepoznat način otvaranja galerije.', 'Unknown gallery opening mode.', 'Неизвестный режим открытия галереи.'],
  badStatus: ['Nepoznat status.', 'Unknown status.', 'Неизвестный статус.'],
  describeRequest: ['Opišite šta želite.', 'Describe what you would like.', 'Опишите, что вы хотите.'],
  companionNotInvited: ['Pratilac nije na spisku pozvanih.', 'This companion is not on the invited list.', 'Этого спутника нет в списке приглашённых.'],
  dateRequired: ['Unesite datum venčanja.', 'Enter the wedding date.', 'Укажите дату свадьбы.'],
  namesRequired: ['Unesite imena mladenaca.', "Enter the couple's names.", 'Укажите имена молодожёнов.'],
  invalidEmail: ['Unesite ispravan email.', 'Enter a valid email.', 'Введите правильный email.'],
  namedCompanionRequired: ['Upišite bar jedno ime pratioca.', 'Enter at least one companion name.', 'Укажите хотя бы одно имя спутника.'],
  moreNamesThanPersons: ['Više imena pratilaca nego osoba koje dolaze.', 'More companion names than people coming.', 'Имён спутников больше, чем придёт человек.'],
  invalidPhone: ['Unesite ispravan broj telefona, npr. 064 123 4567.', 'Enter a valid phone number, e.g. +381 64 123 4567.', 'Введите правильный номер телефона, например +381 64 123 4567.'],
  accountDisabled: ['Nalog je deaktiviran. Javite se administratoru.', 'This account has been deactivated. Please contact the administrator.', 'Аккаунт деактивирован. Обратитесь к администратору.'],
  accountNotFound: ['Nalog nije pronađen.', 'Account not found.', 'Аккаунт не найден.'],
  adminOnly: ['Ovo je dostupno samo superadminu.', 'This is available to the superadmin only.', 'Это доступно только суперадмину.'],
  celebrantRequired: ['Unesite ime slavljenika.', "Enter the guest of honour's name.", 'Укажите имя виновника торжества.'],
  celebrationDateRequired: ['Unesite datum proslave.', 'Enter the celebration date.', 'Укажите дату праздника.'],
  personsRange: ['Broj osoba mora biti između 1 i {{max}}.', 'The number of people must be between 1 and {{max}}.', 'Количество человек должно быть от 1 до {{max}}.'],
};

const LANGS = ['sr', 'en', 'ru'];

export function translateMessage(key, params = {}, acceptLanguage = 'sr') {
  const lang = String(acceptLanguage || 'sr').slice(0, 2).toLowerCase();
  const row = MESSAGES[key];
  if (!row) return key;
  const text = row[Math.max(0, LANGS.indexOf(lang))];
  return text.replace(/\{\{(\w+)\}\}/g, (_, k) => String(params[k] ?? ''));
}
