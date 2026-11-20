# API ugovor (za backend)

Frontend šalje sve zahteve kroz `axiosInstance` iz `src/app/config/api.js`, a pozivi su definisani po feature-ima u `src/features/<feature>/api/`.
Mock server (`src/mock/server.js`) implementira tačno ovaj ugovor, pa je on i referentna implementacija.

- Bazni URL: `VITE_API_BASE_URL` (development: `http://localhost:8001/api/v1`, production: `/api`)
- Format: JSON (`Content-Type: application/json`), osim uploada slika (`multipart/form-data`)
- Autentifikacija mladenaca: `Authorization: Bearer <token>`
- Javni endpointi (`/public/*`) ne traže token; gost se identifikuje tokenom iz ličnog linka
- Greške: HTTP status + `{ "message": "Čitljiva poruka na srpskom" }`. Frontend prikazuje `message` korisniku.
  `401` → frontend odjavljuje korisnika.

## Modeli

```ts
User      { id, email, name, phone, weddingId }   // phone: obavezan, E.164 (+381641234567), važi za ceo nalog

Wedding   {
  id, slug, partner1, partner2,
  date: 'YYYY-MM-DD', rsvpDeadline: 'YYYY-MM-DD', city,
  invitation: {
    templateId: 'klasik' | 'minimal' | 'botanika' | 'noc',
    accentColor: '#RRGGBB', headline, message,
    schedule: [{ id, time: 'HH:mm', title, place, mapUrl }]
  },
  settings: {
    autoApprovePhotos: bool, allowGeneralUpload: bool,
    galleryOpen: 'now' | 'after_wedding' | 'manual',   // kada gosti vide galeriju
    galleryManualOpen: bool,                          // važi samo za 'manual'
    galleryViaQr: bool                                // galerija i preko QR linka (/w/:slug/galerija)
  },
  photoSubscribers: [{ id, email, name, createdAt: ISO, sentAt: ISO | null }]  // emailovi ostavljeni preko QR linka
}

Guest     {
  id, weddingId, name, token, email, phone,
  side: 'mlada' | 'mladozenja' | 'zajednicki',
  companions: {                       // ko sme da dođe sa gostom
    type: 'none' | 'open' | 'named',  // open = „+N bez imena“, named = tačno navedene osobe
    max: number,                      // open: najviše pratilaca; named: = names.length
    names: string[]                   // samo za named
  },
  maxPersons: number,                 // izvedeno: 1 + broj pratilaca (BE računa)
  invitedAt: ISO, openedAt: ISO | null,
  rsvp: {
    status: 'pending' | 'yes' | 'no', persons: number,   // persons uključuje i gosta
    companions: string[],             // imena pratilaca koji dolaze (named: podskup names; open: opciono)
    note: string, respondedAt: ISO | null
  },
  photoNotify: { email: string, requestedAt: ISO | null, sentAt: ISO | null }  // email koji je gost ostavio za obaveštenje o slikama
}

Photo     {
  id, weddingId, guestId | null, senderName,
  category: 'memories' | 'wedding', message,
  status: 'pending' | 'approved' | 'hidden',
  url,            // URL za prikaz (thumbnail/web verzija); original čuvati posebno za štampu
  createdAt: ISO
}

DesignRequest {
  id, weddingId, type: 'invitation' | 'big_album' (stari zahtevi mogu imati 'album' | 'both'), style, pages: number | null,
  budget, description, includePrint: bool,
  status: 'received' | 'in_progress' | 'review' | 'done', designerNote, createdAt,
  contactPhone   // kopija broja sa naloga u trenutku slanja
}

```

## Auth

| Metod | Putanja | Telo | Odgovor |
|---|---|---|---|
| POST | `/auth/login` | `{ email, password }` | `{ token, user: User }` |
| POST | `/auth/register` | `{ email, password, partner1, partner2, date, phone }` | `{ token, user: User }` – pravi i nalog i venčanje; `phone` obavezan → `422`, zauzet email → `409` |
| GET | `/auth/me` | – | `{ user: User }` |
| PATCH | `/auth/me` | `{ name?, phone? }` | `{ user: User }` – `phone` se ne može obrisati (prazan/nevažeći → `422`) |

## Venčanje (mladenci)

| Metod | Putanja | Telo | Odgovor |
|---|---|---|---|
| GET | `/weddings/current` | – | `Wedding` |
| PATCH | `/weddings/:id` | bilo koji podskup: `slug, partner1, partner2, date, rsvpDeadline, city, invitation, settings` (`invitation` i `settings` se spajaju sa postojećim) | `Wedding` |

Validacija `slug`: `^[a-z0-9-]{3,40}$`, jedinstven → `422`.

## Gosti

| Metod | Putanja | Telo | Odgovor |
|---|---|---|---|
| GET | `/weddings/:id/guests` | – | `Guest[]` |
| POST | `/weddings/:id/guests` | `{ name, email?, phone?, side?, companions? }` | `Guest` (server generiše `token`) |
| POST | `/weddings/:id/guests/import` | `{ guests: [{ name, maxPersons?, phone?, email?, side? }] }` | `Guest[]` (samo novi; `maxPersons > 1` → `companions: { type: 'open', max: maxPersons - 1 }`) |
| PATCH | `/guests/:id` | podskup `name, email, phone, side, companions, rsvp: { status: 'pending'\|'yes'\|'no', persons, companions }` | `Guest` |
| DELETE | `/guests/:id` | – | `{ id }` |

`token` mora biti nepredvidiv (preporuka: 8+ znakova, base62) jer je on jedini „ključ“ gosta.

Validacija pratilaca (`422`): `named` traži bar jedno ime (najviše 19), `open` traži `max` 1–19.
Kad se `companions` promeni bez novog `rsvp`, BE zadržava samo pratioce iz `rsvp.companions` koji su i dalje na spisku.

## Obaveštenje gostima o slikama

| Metod | Putanja | Telo | Odgovor |
|---|---|---|---|
| POST | `/weddings/:id/photo-notifications` | – | `{ sent, sentAt, guestIds, subscriberIds }` |

Šalje mejl „slike su spremne“ svim gostima sa `photoNotify.email` i `sentAt = null`, i `photoSubscribers` bez `sentAt`
(samo ako je `galleryViaQr = true`). Svakom postavlja `sentAt`, pa niko ne dobija mejl dvaput.
Galerija mora biti otvorena, inače `409`. Gost dobija svoj lični link `…/i/:token/galerija`, a QR pretplatnik `…/w/:slug/galerija`.

## Fotografije (mladenci)

| Metod | Putanja | Telo | Odgovor |
|---|---|---|---|
| GET | `/weddings/:id/photos` | – | `Photo[]` (najnovije prve) |
| PATCH | `/photos/:id` | `{ status }` | `Photo` |
| POST | `/weddings/:id/photos/bulk-status` | `{ ids: string[], status }` | `Photo[]` (izmenjene) |
| DELETE | `/photos/:id` | – | `{ id }` |

## Custom dizajn

| Metod | Putanja | Telo | Odgovor |
|---|---|---|---|
| GET | `/weddings/:id/design-requests` | – | `DesignRequest[]` (najnoviji prvi) |
| POST | `/weddings/:id/design-requests` | `{ type, style, pages, budget, description, includePrint }` | `DesignRequest` – BE upisuje `contactPhone` sa naloga; nalog bez broja → `422` |

## Javno (gosti, bez prijave)

| Metod | Putanja | Telo | Odgovor |
|---|---|---|---|
| GET | `/public/invitations/:token` | – | `{ guest: PublicGuest, wedding: PublicWedding }` |
| POST | `/public/invitations/:token/opened` | – | `{ ok: true }` (postavlja `openedAt` prvi put) |
| POST | `/public/invitations/:token/rsvp` | `{ status: 'yes'\|'no', persons, companions: string[], note }` | `{ rsvp }` (`named`: `persons` = 1 + izabrani; nepoznato ime → `422`) |
| POST | `/public/invitations/:token/notify` | `{ email }` | `{ notifyEmail }` – nova adresa poništava `sentAt` |
| GET | `/public/invitations/:token/gallery` | – | `PublicGallery` |
| POST | `/public/invitations/:token/photos` | `multipart`: `files[]`, `category`, `senderName`, `message` | `{ uploaded, photos: [{ id, status }] }` |
| GET | `/public/weddings/:slug` | – | `PublicWedding` |
| POST | `/public/weddings/:slug/photos` | isto kao gore | isto (403 ako je `allowGeneralUpload=false`) |
| GET | `/public/weddings/:slug/gallery` | – | `PublicGallery` (403 ako je `galleryViaQr=false`) |
| POST | `/public/weddings/:slug/notify` | `{ email, name? }` | `{ notifyEmail }` – upis u `photoSubscribers` (bez duplikata; 403 ako je `galleryViaQr=false`) |

`PublicWedding` = `{ slug, partner1, partner2, date, rsvpDeadline, city, invitation, settings: { allowGeneralUpload }, gallery: { open, mode, opensAt, viaQr } }`
— bez privatnih podataka (spisak gostiju, email…).

`PublicGuest` = `{ name, token, maxPersons, companions, rsvp, notifyEmail, prefillEmail }`
— `prefillEmail` je `photoNotify.email`, a ako ga nema, email koji su mladenci upisali gostu.

`PublicGallery` = `{ open, mode, opensAt: 'YYYY-MM-DD' | null, photos: [{ id, url, senderName, message, category, createdAt }] }`
— `photos` su samo odobrene slike i prazni su dok je galerija zatvorena.
Galerija je otvorena kad je `galleryOpen = 'now'`, kad je `'manual'` i `galleryManualOpen = true`,
ili kad je `'after_wedding'` i danas je ≥ dan posle `date`.

Pravila za upload: samo `image/*`, najviše 50 fajlova po zahtevu; nova slika dobija `status = autoApprovePhotos ? 'approved' : 'pending'`.
Preporuka: rate-limit po tokenu/IP-u, originale u S3/R2, a thumbnail i web verziju praviti u pozadini.

## Samo u mock režimu

`POST /__mock/reset` – vraća demo podatke na početno stanje (dugme u Podešavanjima).
