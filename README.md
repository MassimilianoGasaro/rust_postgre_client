# Allenamento - client web

Client Angular (Material, Transloco, ECharts) per la piattaforma di allenamento sportivo. Il backend Rust e' un repository separato: https://github.com/MassimilianoGasaro/rust_postgre

## Prerequisiti

- Node.js 22.12 o superiore (Angular 21) e **npm 11 o superiore**
- Backend avviato in HTTPS su `https://localhost:3000` (certificato self-signed): in sviluppo `proxy.conf.json` inoltra `/api` al backend con `secure: false`.

## Installazione

```bash
npm install
```

Con npm 10, `npm install` fallisce con `Cannot read properties of null (reading 'edgesOut')` (bug di npm 10 nella risoluzione delle peer dependency di vitest/jsdom). Aggiorna npm (`npm i -g npm@11`) oppure usa `npx npm@11 install`.

## Avvio in sviluppo

Con il backend gia' in esecuzione:

```bash
npm start
```

L'app e' servita su http://localhost:4200; le chiamate a `/api/...` passano dal proxy.

## Deploy

L'app deve essere servita dalla **radice del sito** (`/`): le traduzioni sono caricate dal percorso assoluto `/i18n/<lingua>.json`, quindi un deploy in un sotto-percorso (es. `https://host/app/`) non le trova.

### Indirizzo del backend

In sviluppo le chiamate `/api/...` restano relative (proxy di `ng serve`). La build di produzione usa `src/environments/environment.prod.ts`: `apiBaseUrl` e' l'indirizzo pubblico del backend su Render (`https://rust-postgre-api.onrender.com`) e viene anteposto alle chiamate `/api/...`. Se il servizio Render ha un altro indirizzo, aggiorna quel valore. Il backend deve avere `CORS_ORIGIN` uguale all'indirizzo del client (es. `https://rust-postgre-client.pages.dev`).

### Cloudflare Pages

Il deploy parte dalla CI (`.github/workflows/ci.yml`, job `deploy`) a ogni push su `main`, solo se test e build sono verdi. La build avviene su GitHub (serve npm 11), Cloudflare riceve solo i file statici (progetto "Direct Upload"). Senza `404.html`, Pages serve `index.html` per ogni percorso: le route Angular funzionano anche ricaricando la pagina.

Configurazione una tantum:

1. Crea il progetto: `npx wrangler login` e poi `npx wrangler pages project create rust-postgre-client --production-branch=main` (oppure dalla dashboard: Workers & Pages → Create → Pages → Upload assets, con lo stesso nome).
2. Crea un API token (My Profile → API Tokens) con il permesso **Account → Cloudflare Pages → Edit**.
3. Nel repo GitHub (Settings → Secrets and variables → Actions) aggiungi `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` (l'ID e' nella dashboard Cloudflare, colonna di destra della pagina Workers & Pages).

## Test e build

```bash
npx ng test            # test unitari (Vitest), modalita' watch
npx ng test --watch=false
npx ng build
```

## Internazionalizzazione

Le traduzioni sono in `public/i18n/it.json` (default) e `public/i18n/en.json`: le due lingue devono avere lo stesso insieme di chiavi (verificato da `src/app/i18n-keys.spec.ts`).

## Licenza

Una licenza non e' ancora stata scelta.
