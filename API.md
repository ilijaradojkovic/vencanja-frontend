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
  settings: { autoApprovePhotos: bool, galleryUnlockAfterWedding: bool, allowGeneralUpload: bool }
}

Guest     {
  id, weddingId, name, token, email, phone,
  side: 'mlada' | 'mladozenja' | 'zajednicki',
  maxPersons: number, invitedAt: ISO, openedAt: ISO | null,
  rsvp: { status: 'pending' | 'yes' | 'no', persons: number, note: string, respondedAt: ISO | null }
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
| POST | `/weddings/:id/guests` | `{ name, email?, phone?, side?, maxPersons? }` | `Guest` (server generiše `token`) |
| POST | `/weddings/:id/guests/import` | `{ guests: [{ name, maxPersons?, phone?, email?, side? }] }` | `Guest[]` (samo novi) |
| PATCH | `/guests/:id` | podskup `name, email, phone, side, maxPersons, rsvp: { status, persons }` | `Guest` |
| DELETE | `/guests/:id` | – | `{ id }` |

`token` mora biti nepredvidiv (preporuka: 8+ znakova, base62) jer je on jedini „ključ“ gosta.

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
| GET | `/public/invitations/:token` | – | `{ guest: { name, maxPersons, rsvp, token }, wedding: PublicWedding }` |
| POST | `/public/invitations/:token/opened` | – | `{ ok: true }` (postavlja `openedAt` prvi put) |
| POST | `/public/invitations/:token/rsvp` | `{ status: 'yes'|'no', persons, note }` | `{ rsvp }` |
| POST | `/public/invitations/:token/photos` | `multipart`: `files[]`, `category`, `senderName`, `message` | `{ uploaded, photos: [{ id, status }] }` |
| GET | `/public/weddings/:slug` | – | `PublicWedding` |
| POST | `/public/weddings/:slug/photos` | isto kao gore | isto (403 ako je `allowGeneralUpload=false`) |

`PublicWedding` = `{ slug, partner1, partner2, date, rsvpDeadline, city, invitation, settings: { allowGeneralUpload } }`
— bez privatnih podataka (spisak gostiju, email…).

Pravila za upload: samo `image/*`, najviše 50 fajlova po zahtevu; nova slika dobija `status = autoApprovePhotos ? 'approved' : 'pending'`.
Preporuka: rate-limit po tokenu/IP-u, originale u S3/R2, a thumbnail i web verziju praviti u pozadini.

## Samo u mock režimu

`POST /__mock/reset` – vraća demo podatke na početno stanje (dugme u Podešavanjima).
