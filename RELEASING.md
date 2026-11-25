# Rilasciare una nuova versione

Procedura per pubblicare una versione del client: cambio di versione, rilascio in produzione,
tag e Release su GitHub. Il backend ha una procedura analoga nel suo repository
(`RELEASING.md` di `rust_postgre`); backend e client hanno versioni indipendenti.

Nei comandi, `X.Y.Z` è la nuova versione (es. `0.2.0`).

## Panoramica

```
release/vX.Y.Z ──PR──▶ develop ──PR──▶ main ──▶ Cloudflare Pages ──▶ tag vX.Y.Z
                                         │
                                         └──PR──▶ develop (riallineamento)
```

`main` e `develop` sono protetti: ogni passaggio avviene con una Pull Request e la CI verde.
Ogni merge su `main` viene pubblicato su Cloudflare Pages dal job `deploy` della CI, solo se
test e build sono verdi.

## 1. Scegli il numero di versione

Si segue il [Semantic Versioning](https://semver.org/lang/it/), `MAJOR.MINOR.PATCH`:

| Cosa contiene il rilascio | Cosa aumenta | Esempio |
|---|---|---|
| solo correzioni, documentazione, manutenzione (`fix:`, `docs:`, `chore:` …) | PATCH | `0.2.3 → 0.2.4` |
| almeno una funzionalità nuova (`feat:`) | MINOR | `0.2.4 → 0.3.0` |
| una modifica incompatibile (`feat!:`, `BREAKING CHANGE`) | MAJOR (in `0.x`: MINOR) | `1.4.0 → 2.0.0` |

Quando un numero sale, quelli alla sua destra tornano a 0.

Ultimo tag e commit da rilasciare:

```
git switch develop
git pull
git fetch --tags
git describe --tags --abbrev=0
git log --oneline v0.1.0..develop
```

`git describe` restituisce l'ultima versione rilasciata: usala al posto di `v0.1.0` nel comando
successivo, che elenca i commit non ancora rilasciati.

### Compatibilità con l'API

Se il rilascio usa qualcosa che l'API pubblicata non ha ancora (nuovo endpoint, nuovo campo,
nuovo parametro):

1. **rilascia prima l'API** (procedura in `RELEASING.md` di `rust_postgre`) e verifica la
   versione online, nel campo `version` della risposta:

   ```
   curl https://rust-postgre-api.onrender.com/api/health
   ```

2. aggiorna la tabella **Compatibilità con l'API** del `README.md` con la nuova versione minima,
   nello stesso branch `release/vX.Y.Z` (punto 2);
3. scrivi il requisito nella Release (punto 5).

Se il client usa solo ciò che l'API già offre, la tabella non cambia.

## 2. Aggiorna la versione nel progetto

La versione in `package.json` deve coincidere con il tag.

```
git switch develop
git pull
git switch -c release/vX.Y.Z
npm version X.Y.Z --no-git-tag-version
git diff --stat
```

`npm version` aggiorna insieme `package.json` e `package-lock.json`: non modificare il numero a
mano, altrimenti il lockfile resta indietro. `--no-git-tag-version` evita che npm crei da solo
commit e tag (il tag va creato su `main`, al punto 4). `git diff --stat` deve mostrare solo
quei due file.

```
git commit -am "chore: release vX.Y.Z"
git push -u origin release/vX.Y.Z
```

Su GitHub apri la Pull Request `release/vX.Y.Z → develop`, attendi la CI verde e fai il merge.

## 3. Rilascia: da `develop` a `main`

Su GitHub: **Pull requests → New pull request**, base `main`, compare `develop`.

- Titolo: `release: vX.Y.Z`
- Attendi la CI verde, poi **Merge pull request**.

Il deploy parte da solo. Verifica:

- nella scheda **Actions** del repository i job `client` e `deploy` del commit su `main` sono
  verdi;
- il sito risponde con la nuova versione: apri https://rust-postgre-client.pages.dev e ricarica
  la pagina (Ctrl+F5 per ignorare la cache del browser).

Se il job `deploy` fallisce, la versione precedente resta online: correggi con un `fix` (dal punto 2)
e ripeti, senza creare il tag.

## 4. Crea il tag

Il tag va sul commit di `main` appena pubblicato.

```
git switch main
git pull
git log --oneline -1
git tag -a vX.Y.Z -m "vX.Y.Z: <riassunto in una riga>"
git push origin vX.Y.Z
```

- `-a` crea un tag annotato (con autore, data e messaggio): è quello da usare per i rilasci.
- `git push` da solo non invia i tag: va indicato il nome.

Verifica che sia su GitHub:

```
git ls-remote --tags origin vX.Y.Z
```

## 5. Crea la Release su GitHub

Nel repository: **Releases → Draft a new release**.

1. **Choose a tag**: `vX.Y.Z`.
2. **Generate release notes**: GitHub elenca le Pull Request incluse.
3. Rileggi le note, aggiungi in cima un riassunto se serve, poi **Publish release**. Se la
   versione minima dell'API è cambiata, aggiungi una sezione:

   ```markdown
   ## Requisiti
   - Richiede API (rust_postgre) **≥ vA.B.C**: <cosa usa di nuovo>.
   ```

## 6. Riallinea `develop`

Il merge su `main` crea un commit che `develop` non ha. Su GitHub apri la Pull Request
`main → develop` (titolo `chore: sync develop with main after vX.Y.Z`), attendi la CI e fai il
merge.

Poi aggiorna la copia locale ed elimina il branch di rilascio, ormai inutile:

```
git switch develop
git pull
git branch -d release/vX.Y.Z
git push origin --delete release/vX.Y.Z
```

## Hotfix: correzione urgente in produzione

Quando un bug in produzione va corretto subito e `develop` contiene già modifiche non pronte
per il rilascio:

```
git switch main
git pull
git switch -c hotfix/descrizione-breve
```

1. Correggi il bug, aggiungi il test e porta la versione alla PATCH successiva con
   `npm version X.Y.Z --no-git-tag-version`.
2. Commit e push:

   ```
   git commit -am "fix: descrizione"
   git push -u origin hotfix/descrizione-breve
   ```

3. Pull Request `hotfix/descrizione-breve → main`, CI verde, merge: il job `deploy` pubblica.
4. Tag e Release come ai punti 4 e 5.
5. Pull Request `main → develop` per portare la correzione anche in `develop`: senza questo
   passaggio il bug torna al rilascio successivo.

## Correggere un tag sbagliato

- **Non ancora pushato**: eliminalo e ricrealo.

  ```
  git tag -d vX.Y.Z
  git tag -a vX.Y.Z -m "..."
  ```

- **Già pushato**: non spostarlo, perché chi lo ha già scaricato resta con la versione vecchia e
  la Release vi fa riferimento. Rilascia invece la versione successiva. Solo se nessuno lo ha
  ancora usato, si può eliminare anche da GitHub:

  ```
  git push origin --delete vX.Y.Z
  git tag -d vX.Y.Z
  ```

## Checklist

- [ ] Numero di versione scelto (punto 1)
- [ ] Se serve una nuova API: API già rilasciata, tabella di compatibilità nel README aggiornata
- [ ] `package.json` e `package-lock.json` aggiornati con `npm version`, PR `release/vX.Y.Z → develop` unita
- [ ] PR `develop → main` unita, job `deploy` verde, sito aggiornato
- [ ] Tag `vX.Y.Z` creato su `main` e pushato
- [ ] Release pubblicata su GitHub
- [ ] PR `main → develop` unita, branch `release/vX.Y.Z` eliminato

## Comandi utili

| Comando | A cosa serve |
|---|---|
| `git tag` | elenco dei tag locali |
| `git ls-remote --tags origin` | elenco dei tag su GitHub |
| `git fetch --tags` | scarica i tag creati su GitHub |
| `git show vX.Y.Z` | dettagli del tag e del commit |
| `git log --oneline v0.1.0..v0.2.0` | cosa è cambiato tra due versioni |
| `git switch --detach vX.Y.Z` | guarda il codice di una versione (poi `git switch develop`) |
