# Client Fase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Creare il client web responsive e bilingue (IT/EN) per atleti e allenatori: login/registrazione, import file, dashboard con intervallo di date, profilo, gestione della relazione allenatore-atleta.

**Architecture:** App Angular standalone in un repo indipendente `rust_postgre_client`, cartella sorella di `rust_postgre`. Uno strato `core/` (modelli API, servizi HTTP, autenticazione, interceptor, guard) e una cartella per funzionalità in `features/`. Il componente dashboard è unico e riceve opzionalmente `athleteId`, così la vista dell'allenatore riusa quella dell'atleta.

**Tech Stack:** Angular (ultima stabile, standalone, signals, TypeScript strict), Angular Material + CDK (layout/breakpoint), Transloco (i18n a runtime), ECharts via `ngx-echarts`, test runner di default del CLI Angular.

**Spec:** `rust_postgre/docs/superpowers/specs/2026-11-22-piattaforma-allenamento-fase1-design.md`
**Contratto API:** `rust_postgre/docs/superpowers/plans/2026-11-22-backend-fase1.md` (sezioni Interfaces dei Task 1–3 e 7–9). Il backend va eseguito **prima** di questo piano.

## Global Constraints

- Repo indipendente: nessun riferimento a file del repo backend a runtime o in build.
- Tutte le chiamate HTTP usano percorsi relativi `/api/...`; in sviluppo `proxy.conf.json` inoltra `/api` → `https://localhost:3000` con `"secure": false`.
- Responsive: **parità di funzioni** tra mobile e desktop. Breakpoint mobile = CDK `Breakpoints.Handset`.
- Ogni testo visibile passa da Transloco; lingue `it` (default) e `en`; file `public/i18n/it.json` e `public/i18n/en.json` con **lo stesso insieme di chiavi**.
- Messaggi d'errore: chiave `errors.<CODE>` dal campo `code` della risposta; codice sconosciuto → `errors.GENERIC`.
- Unità metriche: distanza in km con 1 decimale, durata `h:mm` (o `m:ss` sotto l'ora), dislivello in m.
- Chiavi localStorage: `rp.auth` (token + utente), `rp.lang`.
- Ruoli: `athlete`, `coach`.

## Review Focus

1. **Chiavi di traduzione mancanti** in una delle due lingue → test `i18n files have identical key sets` (Task 1).
2. **Token scaduto mentre l'app è aperta** → al primo 401 su una chiamata non-auth: logout, redirect a `/login?expired=1`, messaggio tradotto. → test interceptor (Task 2).
3. **Upload lungo su mobile e utente che cambia pagina** → l'import continua lato server; la pagina Import mostra gli import recenti (`GET /api/imports`) con il loro stato. → test `shows recent imports on load` (Task 4).
4. **Utente nuovo senza attività** → dashboard con stato vuoto e link a Import, nessun grafico rotto. → test `empty state when totals.count is 0` (Task 5).
5. **Allenatore su un atleta che nel frattempo ha revocato** → `403 ATHLETE_ACCESS_DENIED`: messaggio e ritorno all'elenco atleti. → test (Task 7).

---

## File Structure

```
rust_postgre_client/
  proxy.conf.json
  public/i18n/it.json, en.json
  src/app/
    app.config.ts  app.routes.ts  app.ts (shell)
    core/
      api/models.ts                 — tipi dell'API
      api/errors.ts                 — errorKey()
      api/user-api.ts coach-link-api.ts import-api.ts activity-api.ts stats-api.ts
      auth/auth.service.ts auth.interceptor.ts guards.ts
      i18n/transloco-loader.ts language.service.ts
      format/format.pipes.ts        — distanceKm, duration
    layout/shell.component.ts       — toolbar + sidenav responsive + selettore lingua
    features/
      auth/login.page.ts register.page.ts
      dashboard/dashboard.component.ts date-range.component.ts dashboard.page.ts
      import/import.page.ts
      profile/profile.page.ts
      my-coach/my-coach.page.ts
      coach/requests.page.ts athletes.page.ts athlete-dashboard.page.ts
```

---

### Task 1: Scaffold, proxy, Material, Transloco, ECharts, repo git

**Files:** tutto il progetto generato; Create: `proxy.conf.json`, `public/i18n/it.json`, `public/i18n/en.json`, `src/app/core/i18n/transloco-loader.ts`, `src/app/i18n-keys.spec.ts`, `README.md`

- [ ] **Step 1:** Nella cartella che contiene `rust_postgre` (cartella madre comune): `npx @angular/cli@latest new rust_postgre_client --style=scss --routing --ssr=false --skip-git=false` (standalone e strict sono default). `cd rust_postgre_client; npx ng add @angular/material` (tema a scelta, tipografia sì); `npm i @jsverse/transloco echarts ngx-echarts`.
- [ ] **Step 2:** `proxy.conf.json`: `{"/api": {"target": "https://localhost:3000", "secure": false, "changeOrigin": true}}`; in `angular.json` → `serve.options.proxyConfig`. Configurare Transloco in `app.config.ts` (`availableLangs: ['it','en']`, `defaultLang: 'it'`, `reRenderOnLangChange: true`, loader HTTP da `/i18n/<lang>.json`) e `provideEchartsCore({ echarts: () => import('echarts') })`. Chiavi iniziali: `app.title` (`"Allenamento"` / `"Training"`), `errors.GENERIC`.
- [ ] **Step 3: Test che falliscono.** `src/app/i18n-keys.spec.ts`: importa i due JSON, li appiattisce in chiavi puntate e verifica `expect(keysIt).toEqual(keysEn)` (Review Focus 1). `app.spec.ts`: il componente root mostra `app.title` tradotto in italiano; dopo `setActiveLang('en')` mostra `"Training"`.
- [ ] **Step 4:** `npx ng test --watch=false` → Expected: FAIL; implementare; → Expected: PASS. `npx ng build` → Expected: build ok.
- [ ] **Step 5:** README (italiano): prerequisiti, `npm install`, `npm start` (backend avviato), `npx ng test`. Commit `chore: scaffold Angular app with Material, Transloco, ECharts, proxy`.

---

### Task 2: Core — modelli API, errori, autenticazione, interceptor, guard, servizi HTTP

**Files:** Create: `core/api/models.ts`, `core/api/errors.ts`, `core/api/*-api.ts`, `core/auth/auth.service.ts`, `core/auth/auth.interceptor.ts`, `core/auth/guards.ts`, `core/format/format.pipes.ts` + i rispettivi `.spec.ts`

**Interfaces:**
- Produces:
  - `models.ts`: `type Role = 'athlete' | 'coach'`; `UserInfo { id; email; username; role }`; `AuthResponse { token; user }`; `Profile { language; timezone; birth_date; sex; weight_kg; max_hr; resting_hr; ftp_watts; threshold_pace_s_per_km }`; `Me { id; email; username; role; created_at; profile }`; `CoachLink { id; athlete: UserRef; coach: UserRef; status: 'pending'|'active'|'rejected'|'cancelled'|'revoked'; requested_at; responded_at; ended_at }`; `ImportItem { filename; status: 'pending'|'imported'|'duplicate'|'failed'; activity_id; error_code }`; `ImportDto { id; status: 'processing'|'completed'|'failed'; created_at; finished_at; items?: ImportItem[] }`; `Activity` (campi di `ActivityDto` del backend); `Page<T> { items; total; page; per_page }`; `StatsSummary` (forma del Task 9 backend); `DateRange { from: string; to: string }` (ISO `YYYY-MM-DD`).
  - `errors.ts`: `errorKey(err: unknown): string` → `'errors.' + body.code` se `HttpErrorResponse` con `code` stringa, altrimenti `'errors.GENERIC'`.
  - `AuthService` (root): `readonly user: Signal<UserInfo | null>`, `readonly token: Signal<string | null>`, `readonly role: Signal<Role | null>`, `isLoggedIn: Signal<boolean>`; `login(email, password): Observable<UserInfo>`; `register(req: {email; username; password; role}): Observable<UserInfo>`; `logout(reason?: 'expired'): void` (svuota stato e `rp.auth`, naviga a `/login` con `?expired=1` se `reason`); `homeFor(role: Role): string` → `'/dashboard'` | `'/coach/athletes'`. All'avvio legge `rp.auth` e lo scarta se il claim `exp` del JWT è passato.
  - `authInterceptor` (funzionale): aggiunge `Authorization: Bearer` alle richieste `/api/` se c'è token; su 401 di richieste diverse da `/api/auth/` → `logout('expired')`.
  - `guards.ts`: `authGuard`, `guestGuard` (loggato → `homeFor(role)`), `roleGuard(role: Role)` (ruolo diverso → `homeFor`).
  - API (`providedIn: 'root'`): `UserApi.me()`, `UserApi.update(patch: Partial<Profile> & {email?; username?; password?})`, `UserApi.deleteMe()`; `CoachLinkApi.request(coach: string)`, `list(status?)`, `accept(id)`, `reject(id)`, `cancel(id)`, `revoke(id)`, `athletes(): Observable<{id; username; linked_since}[]>`; `ImportApi.upload(files: File[]): Observable<HttpEvent<ImportDto>>` (`reportProgress: true`, `observe: 'events'`, campo `files` ripetuto), `get(id)`, `recent()`; `ActivityApi.list(range: Partial<DateRange> & {sport?; page?; per_page?; athlete_id?})`, `delete(id)`; `StatsApi.summary(range: DateRange, opts?: {sport?; granularity?; athlete_id?})`.
  - Pipe standalone: `distanceKm` (m → `"12,3 km"` / `"12.3 km"` secondo la lingua attiva), `duration` (s → `"1:05"` per 3900 s, `"9:30"` per 570 s).
- [ ] **Step 1: Test che falliscono** (`HttpTestingController`): `errorKey` con `{code:'EMAIL_TAKEN'}` → `errors.EMAIL_TAKEN`, con errore di rete → `errors.GENERIC`; `AuthService.login` salva token+utente in `rp.auth` e `role()` == `'athlete'`; token con `exp` passato in `rp.auth` → all'avvio `isLoggedIn()` false; interceptor aggiunge l'header solo su `/api/`; 401 su `/api/activities` → `logout('expired')` chiamato; 401 su `/api/auth/login` → nessun logout (Review Focus 2); `roleGuard('coach')` con atleta → `UrlTree` `/dashboard`; `ImportApi.upload` invia `FormData` con due voci `files`; pipe `duration(3900) === '1:05'`, `duration(570) === '9:30'`, `distanceKm(12345)` in it → `'12,3 km'`.
- [ ] **Step 2:** `npx ng test --watch=false` → FAIL; implementare; → PASS.
- [ ] **Step 3:** Commit `feat: core API models, auth, interceptor, guards`.

---

### Task 3: Shell responsive, lingua, login e registrazione

**Files:** Create: `layout/shell.component.ts`, `core/i18n/language.service.ts`, `features/auth/login.page.ts`, `features/auth/register.page.ts`; Modify: `app.routes.ts`, `app.ts`, file i18n

**Interfaces:**
- Consumes: `AuthService`, guard, `UserApi`, `errorKey`
- Produces:
  - `LanguageService`: `init(): void` (ordine: `profile.language` dopo login → `rp.lang` → `navigator.language` che inizia con `it` → `it`, altrimenti `en`); `set(lang: 'it'|'en'): void` (Transloco + `rp.lang` + `UserApi.update({language})` se loggato).
  - Rotte: `/login`, `/register` (guestGuard); dentro la shell (authGuard): `/dashboard`, `/import`, `/my-coach` (athlete), `/coach/requests`, `/coach/athletes`, `/coach/athletes/:id` (coach), `/profile` (entrambi); `''` e `**` → redirect a `homeFor(role)` o `/login`.
  - Shell: toolbar con titolo, selettore lingua IT/EN, menu utente (profilo, logout); `mat-sidenav` `mode="side"` aperta su desktop, `mode="over"` con pulsante hamburger su Handset; voci di menu diverse per ruolo.
  - Login: email, password, messaggio `auth.sessionExpired` se `?expired=1`, errori via `errorKey`. Registrazione: email, username, password (min 8), ruolo (radio atleta/allenatore, default atleta); dopo successo → `homeFor(role)`.
- [ ] **Step 1: Test che falliscono:** login con credenziali errate mostra il testo di `errors.INVALID_CREDENTIALS`; login riuscito naviga a `/dashboard` per atleta e `/coach/athletes` per coach; register invia `role: 'coach'` se selezionato; password < 8 disabilita il submit; `?expired=1` mostra il messaggio; shell su viewport Handset (mock di `BreakpointObserver`) usa `mode="over"`; menu atleta contiene Import e non Richieste; `LanguageService.set('en')` scrive `rp.lang` e chiama `PATCH /api/users/me` se loggato.
- [ ] **Step 2:** test → FAIL; implementare (aggiungere tutte le chiavi it/en usate, inclusi gli `errors.*` dei codici del backend: `VALIDATION_FAILED, EMAIL_TAKEN, USERNAME_TAKEN, INVALID_CREDENTIALS, ACCOUNT_DISABLED, INVALID_TIMEZONE, ROLE_FORBIDDEN, COACH_NOT_FOUND, NOT_A_COACH, COACH_LINK_EXISTS, LINK_INVALID_STATE, ATHLETE_ACCESS_DENIED, NO_FILES, UPLOAD_TOO_LARGE, UNSUPPORTED_FORMAT, PARSE_ERROR, EMPTY_ACTIVITY, FILE_TOO_LARGE, ARCHIVE_TOO_LARGE, IMPORT_INTERRUPTED, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, INTERNAL`); → PASS.
- [ ] **Step 3:** Commit `feat: responsive shell, language switching, login and register`.

---

### Task 4: Pagina Import

**Files:** Create: `features/import/import.page.ts` (+ spec); Modify: i18n

**Interfaces:**
- Consumes: `ImportApi`, `errorKey`
- Produces: pagina `/import` con:
  - Zona trascina-e-rilascia + pulsante "Scegli file" (`<input type=file multiple accept=".fit,.gpx,.tcx,.zip">`), elenco dei file scelti con dimensione, pulsante Carica.
  - Barra di avanzamento dell'upload (eventi `UploadProgress`), poi polling di `ImportApi.get(id)` ogni 1 s finché `status !== 'processing'`; tabella/elenco per file: nome, stato tradotto (`import.status.<status>`), messaggio `errors.<error_code>` se fallito; riepilogo "N importate, N duplicate, N errori".
  - Sezione "Import recenti" (`ImportApi.recent()` al caricamento, con stato).
  - Box istruzioni (testo in i18n): esportare il file originale di una singola attività da Garmin Connect e dall'app Coros; esportare tutti i dati da Garmin (richiesta di export dei dati dell'account → ZIP da caricare così com'è). Il proprietario verifica i nomi esatti dei menu prima del rilascio.
  - Su mobile: elenco a card al posto della tabella.
- [ ] **Step 1: Test che falliscono:** selezione di 2 file e Carica → una POST multipart; eventi di progresso aggiornano la barra; dopo la risposta 202 il componente interroga `GET /api/imports/:id` finché `completed` e mostra 1 importata + 1 `errors.PARSE_ERROR`; `shows recent imports on load` (Review Focus 3); `413` → messaggio `errors.UPLOAD_TOO_LARGE`; il polling si ferma alla distruzione del componente.
- [ ] **Step 2:** test → FAIL; implementare; → PASS.
- [ ] **Step 3:** Commit `feat: import page with progress and per-file results`.

---

### Task 5: Dashboard con intervallo di date

**Files:** Create: `features/dashboard/date-range.component.ts`, `features/dashboard/dashboard.component.ts`, `features/dashboard/dashboard.page.ts` (+ spec); Modify: i18n

**Interfaces:**
- Consumes: `StatsApi`, `ActivityApi`, pipe di formato
- Produces:
  - `DateRangeComponent` — `value = model<DateRange>()`; preset `7d`, `30d`, `90d`, `1y` (ultimi N giorni incluso oggi, nel fuso del browser) + "Personalizzato" con `mat-date-range-input`; default `30d`.
  - `DashboardComponent` — `athleteId = input<number | null>(null)`, `readOnly = input<boolean>(false)`. Intervallo e sport sincronizzati con i query param `from`, `to`, `sport` (ricaricare la pagina mantiene la vista). Mostra: card totali (attività, distanza, tempo in movimento, dislivello); grafico a barre ECharts della `series` (distanza per periodo, tooltip con tempo e numero); grafico a ciambella di `by_sport` per tempo; filtro sport; elenco attività paginato (tabella su desktop, card su Handset) con data/ora locale, sport tradotto (`sport.<sport>`), distanza, durata, dislivello, FC media; pulsante elimina con conferma solo se `!readOnly`. Stato vuoto (`totals.count === 0`): messaggio + link a `/import` (link nascosto se `readOnly`).
  - `DashboardPage` (`/dashboard`) = `<app-dashboard />`.
- [ ] **Step 1: Test che falliscono:** preset `7d` con oggi `2026-11-22` (clock finto) → `{from:'2026-11-16', to:'2026-11-22'}`; cambio preset → nuove chiamate `stats/summary` e `activities` con gli stessi `from`/`to`; query param in ingresso inizializzano l'intervallo; `athleteId=5` aggiunge `athlete_id=5` a entrambe le chiamate; `empty state when totals.count is 0` (Review Focus 4: niente `echarts` renderizzato, link a import presente); elimina → conferma → `DELETE /api/activities/:id` → ricarica; `readOnly` nasconde elimina; su Handset l'elenco usa le card.
- [ ] **Step 2:** test → FAIL; implementare; → PASS.
- [ ] **Step 3:** Commit `feat: dashboard with date range, charts and activity list`.

---

### Task 6: Profilo e "Il mio allenatore"

**Files:** Create: `features/profile/profile.page.ts`, `features/my-coach/my-coach.page.ts` (+ spec); Modify: i18n

**Interfaces:**
- Consumes: `UserApi`, `CoachLinkApi`, `LanguageService`
- Produces:
  - `/profile` (entrambi i ruoli): form con email, username, nuova password (opzionale), lingua, fuso orario (`mat-autocomplete` su `Intl.supportedValuesOf('timeZone')`), e solo per atleta i dati fisiologici (data di nascita, sesso, peso, FC max, FC riposo, FTP, passo di soglia in `m:ss`/km convertito in secondi). Salva inviando solo i campi modificati; campo svuotato → `null`. Pulsante "Elimina account" con doppia conferma → `deleteMe()` → logout.
  - `/my-coach` (atleta): nessun link aperto → campo "email o username dell'allenatore" + Invia; link `pending` → stato + "Annulla richiesta"; link `active` → nome allenatore, data + "Revoca accesso" con conferma; storico dei link chiusi.
- [ ] **Step 1: Test che falliscono:** salvataggio invia solo i campi cambiati; svuotare il peso invia `weight_kg: null`; passo `4:30` → `threshold_pace_s_per_km: 270`; cambio lingua dal profilo applica subito la traduzione; my-coach: invio richiesta con `errors.COACH_NOT_FOUND` mostra il messaggio; stato `pending` mostra Annulla e chiama `/cancel`; stato `active` → Revoca chiama `/revoke` dopo conferma.
- [ ] **Step 2:** test → FAIL; implementare; → PASS.
- [ ] **Step 3:** Commit `feat: profile and athlete coach management`.

---

### Task 7: Area allenatore

**Files:** Create: `features/coach/requests.page.ts`, `features/coach/athletes.page.ts`, `features/coach/athlete-dashboard.page.ts` (+ spec); Modify: i18n

**Interfaces:**
- Consumes: `CoachLinkApi`, `DashboardComponent` (Task 5)
- Produces:
  - `/coach/requests`: richieste `pending` con atleta e data, pulsanti Accetta/Rifiuta; badge con il numero di richieste in attesa nella voce di menu.
  - `/coach/athletes`: elenco atleti attivi (username, "seguito dal"), click → `/coach/athletes/:id`.
  - `/coach/athletes/:id`: intestazione con username + `<app-dashboard [athleteId]="id" [readOnly]="true" />`. Su `403 ATHLETE_ACCESS_DENIED` → snackbar `errors.ATHLETE_ACCESS_DENIED` e navigazione a `/coach/athletes`.
- [ ] **Step 1: Test che falliscono:** Accetta chiama `/accept` e rimuove la riga; Rifiuta chiama `/reject`; elenco atleti naviga al dettaglio; il dettaglio passa `athleteId` e `readOnly` alla dashboard; 403 durante il caricamento → snackbar + redirect (Review Focus 5).
- [ ] **Step 2:** test → FAIL; implementare; → PASS.
- [ ] **Step 3:** Commit `feat: coach requests, athletes list and read-only athlete dashboard`.

---

### Task 8: Verifica end-to-end manuale e pubblicazione su GitHub

- [ ] **Step 1:** Backend avviato (`cargo run`), `npm start`. Su desktop e con emulazione mobile (DevTools, iPhone/Pixel): registrare atleta e allenatore; atleta importa i file di `rust_postgre/docs/files/`; dashboard mostra le attività sui preset e su un intervallo personalizzato; cambio lingua IT↔EN su ogni pagina senza testi non tradotti; richiesta → accettazione → l'allenatore vede la dashboard in sola lettura → revoca → l'allenatore riceve il messaggio e torna all'elenco.
- [ ] **Step 2:** `npx ng test --watch=false` e `npx ng build` → tutto PASS.
- [ ] **Step 3: Pubblicazione** — richiede il proprietario: creare su github.com, con l'account `MassimilianoGasaro`, il repository vuoto `rust_postgre_client` (senza README/licenza; visibilità a sua scelta), oppure installare `gh` ed eseguire `gh auth login`. Poi: `git remote add origin https://github.com/MassimilianoGasaro/rust_postgre_client.git; git push -u origin main`.
- [ ] **Step 4:** Copiare questo piano in `rust_postgre_client/docs/plans/` e committare.
