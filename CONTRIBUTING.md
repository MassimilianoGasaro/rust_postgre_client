# Contribuire

Grazie per l'interesse! Questo è il client web (Angular) della piattaforma di allenamento; il
backend Rust è in un repository separato:
https://github.com/MassimilianoGasaro/rust_postgre

## Prima di iniziare

- Per modifiche non banali apri prima una **issue** e descrivi cosa vuoi fare: si evita di
  lavorare su qualcosa che poi non può essere accettato.
- Per preparare l'ambiente (Node.js 22, **npm 11**, backend in locale) segui il
  [README](README.md).

## Branch

| Branch | Ruolo |
|---|---|
| `main` | produzione: ogni merge viene pubblicato su Cloudflare Pages |
| `develop` | integrazione: base di partenza per ogni modifica |
| `feature/<descrizione>` | nuove funzionalità, da `develop` |
| `fix/<descrizione>` | correzioni, da `develop` |
| `hotfix/<descrizione>` | correzioni urgenti in produzione, da `main` |

`main` e `develop` sono protetti: si passa sempre da una Pull Request con la CI verde.

## Flusso di lavoro

1. Fai il **fork** del repository (pulsante *Fork* su GitHub) e clonalo.
2. Crea un branch partendo da `develop`:

   ```
   git switch develop
   git switch -c feature/nome-breve
   ```

3. Fai le modifiche e i commit, poi il push sul tuo fork.
4. Apri una Pull Request verso **`develop`** di questo repository e compila il template.

Alla prima PR la CI parte dopo l'approvazione di un maintainer (regola di GitHub per chi
contribuisce la prima volta).

## Messaggi di commit

Si usa [Conventional Commits](https://www.conventionalcommits.org/): `tipo: descrizione` in
inglese, all'imperativo.

- `feat:` nuova funzionalità
- `fix:` correzione di un bug
- `docs:`, `test:`, `refactor:`, `chore:`, `ci:`, `build:`, `style:`

## Controlli prima della PR

La CI esegue gli stessi controlli:

```
npm ci
npx ng test --watch=false
npx ng build
```

- **Test**: ogni nuovo componente, servizio o correzione arriva con i suoi test (Vitest).
- **Traduzioni**: ogni testo visibile passa da Transloco. Aggiungi la chiave sia in
  `public/i18n/it.json` sia in `public/i18n/en.json`: un test verifica che le due lingue abbiano
  le stesse chiavi.
- **Responsive**: l'interfaccia deve funzionare sia su desktop sia su mobile; verifica le pagine
  toccate anche a larghezza ridotta.
- **API**: le chiamate passano dai servizi in `src/app/core/api/` con percorsi relativi `/api/...`
  (l'indirizzo del backend lo aggiunge `apiBaseUrlInterceptor`).

## Cosa non committare

- segreti (token, password) e file di ambiente locali;
- file di attività reali o dati personali (posizioni GPS);
- `dist/` e `node_modules/`.

## Licenza

Contribuendo accetti che il tuo contributo sia distribuito con la [licenza MIT](LICENSE) del
progetto.
