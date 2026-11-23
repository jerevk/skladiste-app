# Skladište — samostalna web aplikacija

Ovo je **nova, odvojena** skladišna aplikacija. Ne koristi Google Apps Script ni Google Sheets.

**Tehnologija:** Cloudflare Workers (API i hosting), Cloudflare D1 (zajednička SQL baza), GitHub (izvorni kod).

## Funkcionalnosti

- Korisnici s osobnim PIN-ovima i ulogama administrator / konobar.
- Zajedničko stanje skladišta uz kontrolu istodobnih izmjena.
- Inventura: Pivo, Pića, Žesta, Topli napitci i Frižider (broj praznih mjesta).
- Primka i donos robe, uključujući potvrđivanje pojedinih stavki.
- Povijest ulaza i izlaza u bazi podataka, bez automatskog brisanja nakon dva dana.
- Administracija artikala i zaposlenika, pregled i izvoz u CSV/Excel.
- Početni katalog od 123 artikla/mjesta s količinama **0**; stvarni podaci nisu kopirani.

## Objavljivanje na Cloudflare Workers

Cloudflare račun treba imati pristup repozitoriju `jerevk/skladiste-app`.

1. Na Cloudflareu izradi **D1 bazu** pod nazivom `skladiste-db`.
2. Kopiraj njezin **Database ID** u `wrangler.jsonc` umjesto `REPLACE_WITH_D1_DATABASE_ID`.
3. Primijeni `schema.sql` u D1 bazi (Cloudflare D1 Console ili CLI naredbom `npm run db:remote` nakon prijave s `npx wrangler login`).
4. U Workers postavkama postavi tajnu **SETUP_KEY** (nasumičan dugačak niz). Ako koristiš CLI: `npx wrangler secret put SETUP_KEY`. Ne spremaj tajnu u GitHub.
5. Pokreni `npm install` i `npm run deploy`, odnosno konfiguriraj Cloudflare Git deploy s Workers buildom `npm run deploy` uz potrebne ovlasti.
6. Otvori Workers URL. Prvi put otvara se obrazac **Prvo postavljanje**. Unesi `SETUP_KEY`, svoje ime i administratorski PIN.
7. Nakon prijave promijeni početne količine inventurom ili primkom robe.

### Lokalno testiranje
```sh
npm install
npm run db:local
npm run dev
```
Lokalno testiranje ne mijenja produkcijsku D1 bazu.

## Sigurnost

Repozitorij može biti javan jer nema vjerodajnica ni stvarnih skladišnih podataka. **SETUP_KEY** treba čuvati isključivo u Workers tajnama. Korisnički PIN-ovi se u D1 čuvaju kao PBKDF2 hash, sesije istječu nakon 6 sati. Početna verzija nema reset PIN-a ni napredni nadzor pristupa.

Cloudflare još nije automatski povezan s ovim kodom; sama GitHub objava **ne znači** da je aplikacija već dostupna na Workers URL-u.
