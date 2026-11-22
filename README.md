# Uspomena – web frontend

Aplikacija za digitalne pozivnice i album venčanja koji prave gosti.
React 18 + Redux Toolkit + React Router 6 + Vite. Svi podaci su trenutno mockovani.

## Pokretanje

Monorepo: zamrznuti Vite demo je u `apps/demo`, a Next.js proizvod u `apps/web`.

```bash
# demo (Vite, mock podaci)
npm --prefix apps/demo ci
npm run dev:demo     # http://localhost:5173
npm run build:demo   # apps/demo/dist

# proizvod (Next.js)
npm --prefix apps/web install
npm run dev          # http://localhost:3000
npm run build && npm run preview
```

U nastavku se opisuje demo aplikacija.
Demo nalozi:
- mladenci (svadba): **demo@uspomena.rs / demo123**
- slavljenik (proslava, 18. rođendan): **rodjendan@uspomena.rs / demo123**
- superadmin: **admin@uspomena.rs / admin123**

Javne registracije nema: nalog za mladence pravi superadmin na `/admin`.
Pozivnica gosta: `/i/demo-jelena` (ostali tokeni: `milica`, `kum`, `petrovic`…). QR upload: `/w/ana-i-marko/upload`.

## Šta postoji

**Gosti (javno, mobilni prvo)**
- `/i/:token` – lična pozivnica: koverta koja se otvara, raspored, mapa, `.ics` za kalendar, potvrda dolaska (RSVP)
- `/i/:token/upload` – slanje slika sa ličnog linka (pravi izbor fajlova, drag & drop, pregled, napredak)
- `/w/:slug/upload` – isto, preko opšteg linka / QR koda na stolovima

**Superadmin (`/admin`, samo uloga `superadmin`)**
- Nalozi – pravljenje naloga tipa **svadba** (mlada i mladoženja) ili **proslava** (jedan slavljenik + naziv, npr. „18. rođendan“), izmena, nova lozinka, deaktivacija, brisanje; poruka sa podacima za prijavu za kopiranje

**Mladenci (`/app`, zaštićeno prijavom)**
- Pregled – statistika, odgovori, nove slike, QR kod (preuzimanje PNG)
- Gosti – pretraga, filteri, dodavanje/izmena/brisanje, uvoz spiska, CSV izvoz, kopiranje linka, WhatsApp
- Pozivnica – templejt, boja, tekst, raspored dana, pregled uživo
- Fotografije – moderacija (odobri/sakrij/obriši), grupne akcije, lightbox
- Veliki album – sve odobrene slike kao polaroidi (zid, po gostima, prezentacija za TV), zahtev da ga uradimo mi
- Custom dizajn – zahtev dizajneru i praćenje statusa
- Podešavanja – adresa, pravila za slike, reset demo podataka

## Struktura

```
src/
  main.jsx               ← Provider + BrowserRouter/HashRouter
  app/
    config/
      api.js             ← axiosInstance (baseURL, Bearer token interceptor) + get/set/clearAuthToken
      env.js             ← čitanje .env (getApiBaseUrl, isProduction, isMockEnabled…)
      enums.js           ← enum vrednosti sa BE (RsvpStatus, PhotoStatus, DesignRequestStatus…)
    app.jsx              ← koren aplikacije (restore sesije, toast-ovi)
    theme.css            ← svi stilovi: fontovi, boje (CSS promenljive), komponente
    router/router.jsx    ← sve rute
    store/index.store.js ← combineReducers + middleware (greške → toast, 401 → odjava)
    hooks.js
  features/<feature>/    ← auth, wedding, guests, photos, big-album, requests, invite, dashboard, common
    api/<feature>.api.js           ← pozivi ka BE-u (GetGuests, CreateGuest…)
    services/<feature>.service.js  ← createAsyncThunk – zovu funkcije iz api/
    store/<feature>.store.js       ← createSlice (+ selektori)
    pages/<ime>.page.jsx           ← ekrani
    components/                    ← komponente specifične za feature
  components/            ← zajednički UI (AppLayout, Modal, Toasts, Icon, navigation/protected-route)
  mock/                  ← mock backend: adapter.js (axios adapter), server.js (rute), db.js (seed + localStorage)
  utils/                 ← formatiranje, templejti, thunk.utils (toRejectValue, weddingIdFrom)
```

Tok podataka: **page → dispatch(service thunk) → api → axiosInstance → (mock adapter | pravi BE) → store → page**.

## Svadba i proslava

`Wedding.type` je `wedding` ili `celebration`. Proslava ima jedno ime (`partner1`), prazan `partner2` i opcioni `occasion`. Šabloni tada prikazuju samo slavljenika i naziv proslave. Tekstovi se menjaju preko prevoda u `src/locales/<jezik>/celebration/*.json`: ti fajlovi sadrže samo ključeve koji se razlikuju od svadbe, a `setEventType` u `i18n.js` ih uključuje kad se učita proslava.

## Jezici

Sajt je na srpskom (podrazumevano), engleskom i ruskom. Izbor jezika je u meniju, na početnoj strani, prijavi i stranicama za goste i pamti se u browseru.

- Prevodi su u `src/locales/{sr,en,ru}/<oblast>.json` (common, landing, auth, dashboard, guests, invite, templates, photos, bigAlbum, requests, settings, notifications).
- U komponenti: `const { t } = useTranslation('guests'); t('title')`; van komponente: `i18n.t('guests:title')` iz `src/app/config/i18n.js`.
- Novi tekst se dodaje u sva tri jezika pod istim ključem. Množina koristi sufikse `_one/_few/_other` (srpski), `_one/_other` (engleski) i `_one/_few/_many/_other` (ruski).
- Datumi se formatiraju po izabranom jeziku (`utils/format.js`).

## Prelazak na pravi backend

1. Backend implementira ugovor iz [`API.md`](./API.md) (mock u `src/mock/server.js` je referentna implementacija).
2. U `.env` postavite `VITE_USE_MOCK=false`.
3. Bazni URL se čita iz `VITE_API_BASE_URL`:
   ```
   .env.development   VITE_API_BASE_URL=http://localhost:8001/api/v1
   .env.production    VITE_API_BASE_URL=/api
   ```
4. Ništa drugo se ne menja – mock kod se tada ni ne učitava (dinamički import).

`VITE_ROUTER=hash` koristite za statički hosting bez rewrite pravila (linkovi `/#/i/token`);
za `browser` server mora sve nepoznate putanje da vrati na `index.html`.

## Docker

Deploy je test verzija i radi isto kao lokalno: koristi mock backend (`VITE_USE_MOCK=true`), a podaci se čuvaju u `localStorage` browsera. Pravi backend se ne poziva.

```bash
docker build -t uspomena-web .
docker run -p 8080:80 uspomena-web
```

Nginx servira `dist/` i nepoznate putanje vraća na `index.html` (SPA).

## Napomene

- Mock podaci se čuvaju u `localStorage` ovog browsera; poslate slike se smanjuju na ~1100px da stanu.
- Fotografije u demo podacima su generisane ilustracije, ne prave slike.
- Mesta u rasporedu (`[Naziv crkve]`, `[Naziv sale]`) su placeholderi.
