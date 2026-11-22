import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse, HttpEvent, HttpEventType } from '@angular/common/http';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Subscription, exhaustMap, map, takeWhile, tap, timer } from 'rxjs';
import { ImportApi } from '../../core/api/import-api';
import { errorKey } from '../../core/api/errors';
import { ImportDto, ImportItem } from '../../core/api/models';

/** Estensioni accettate dal backend (ZIP incluso); le altre non vengono caricate. */
const ALLOWED_EXTENSIONS = ['.fit', '.gpx', '.tcx', '.zip'];
const POLL_INTERVAL_MS = 1000;

const hasAllowedExtension = (name: string) => {
  const lower = name.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
};

/** 413 senza corpo JSON (rifiuto di un proxy) vale comunque UPLOAD_TOO_LARGE. */
function uploadErrorKey(err: unknown): string {
  const key = errorKey(err);
  if (key === 'errors.GENERIC' && err instanceof HttpErrorResponse && err.status === 413) {
    return 'errors.UPLOAD_TOO_LARGE';
  }
  return key;
}

@Component({
  selector: 'app-import-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, MatProgressBarModule, TranslocoPipe],
  styles: `
    :host {
      display: block;
      max-width: 900px;
      margin: 0 auto;
    }
    h1 {
      margin: 0 0 16px;
      font: var(--mat-sys-headline-medium);
    }
    h2 {
      margin: 0 0 8px;
      font: var(--mat-sys-title-medium);
    }
    section {
      margin-bottom: 24px;
    }
    .drop-zone {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 24px 16px;
      text-align: center;
      border: 2px dashed var(--mat-sys-outline);
      border-radius: 12px;
    }
    .drop-zone.dragging {
      border-color: var(--mat-sys-primary);
      background: var(--mat-sys-primary-container);
    }
    .hidden-input {
      display: none;
    }
    ul.plain {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .file-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 0;
    }
    .file-name {
      flex: 1;
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .muted {
      color: var(--mat-sys-on-surface-variant);
    }
    .actions {
      margin-top: 12px;
    }
    .error {
      padding: 8px 12px;
      border-radius: 8px;
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }
    .notice {
      padding: 8px 12px;
      border-radius: 8px;
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th,
    td {
      padding: 8px;
      text-align: left;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }
    .card {
      padding: 12px;
      margin-bottom: 8px;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 12px;
    }
    .card .name {
      font: var(--mat-sys-label-large);
      overflow-wrap: anywhere;
    }
    .summary {
      margin: 8px 0;
      font: var(--mat-sys-label-large);
    }
    .recent-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 4px 0;
      flex-wrap: wrap;
    }
    .instructions p {
      margin: 0 0 12px;
    }
    .instructions h3 {
      margin: 0 0 4px;
      font: var(--mat-sys-label-large);
    }
  `,
  template: `
    <h1>{{ 'import.title' | transloco }}</h1>

    <section>
      <div
        class="drop-zone"
        data-testid="drop-zone"
        [class.dragging]="dragging()"
        (dragover)="onDragOver($event)"
        (dragleave)="dragging.set(false)"
        (drop)="onDrop($event)"
      >
        <span>{{ 'import.dropHint' | transloco }}</span>
        <span class="muted">{{ 'import.dropOr' | transloco }}</span>
        <button mat-stroked-button type="button" data-testid="choose" (click)="fileInput.click()">
          <mat-icon>attach_file</mat-icon>
          {{ 'import.chooseFiles' | transloco }}
        </button>
        <input
          #fileInput
          class="hidden-input"
          data-testid="file-input"
          type="file"
          multiple
          accept=".fit,.gpx,.tcx,.zip"
          (change)="onFilesChosen(fileInput)"
        />
      </div>

      @if (skipped().length > 0) {
        <p class="notice" data-testid="skipped">
          {{ 'import.skippedTitle' | transloco }}: {{ skipped().join(', ') }}
        </p>
      }

      @if (selected().length > 0) {
        <h2>{{ 'import.selectedTitle' | transloco }}</h2>
        <ul class="plain" data-testid="selected">
          @for (f of selected(); track $index) {
            <li class="file-row">
              <span class="file-name">{{ f.name }}</span>
              <span class="muted">{{ sizeLabel(f.size) }}</span>
              <button
                mat-icon-button
                type="button"
                [attr.data-testid]="'remove-' + $index"
                [attr.aria-label]="'import.remove' | transloco"
                [disabled]="uploading()"
                (click)="remove($index)"
              >
                <mat-icon>close</mat-icon>
              </button>
            </li>
          }
        </ul>
      }

      @if (error(); as key) {
        <p class="error" role="alert" data-testid="error">{{ key | transloco }}</p>
      }

      @if (uploading()) {
        <mat-progress-bar
          data-testid="progress"
          [mode]="progressKnown() ? 'determinate' : 'indeterminate'"
          [value]="progress()"
          [attr.aria-label]="'import.uploading' | transloco"
        />
      }

      <div class="actions">
        <button
          mat-flat-button
          type="button"
          data-testid="upload"
          [disabled]="!canUpload()"
          (click)="upload()"
        >
          {{ (uploading() ? 'import.uploading' : 'import.upload') | transloco }}
        </button>
      </div>
    </section>

    @if (current(); as imp) {
      <section data-testid="results">
        <h2>
          {{ 'import.resultsTitle' | transloco }} —
          {{ 'import.status.' + imp.status | transloco }}
        </h2>
        @if (items().length === 0) {
          @if (imp.status === 'processing') {
            <p class="muted">{{ 'import.processingNote' | transloco }}</p>
          }
        } @else if (handset()) {
          @for (item of items(); track $index) {
            <div class="card" data-testid="result-card">
              <div class="name">{{ item.filename }}</div>
              <div>{{ 'import.status.' + item.status | transloco }}</div>
              @if (noteKey(item); as key) {
                <div class="muted">{{ key | transloco }}</div>
              }
            </div>
          }
        } @else {
          <table>
            <thead>
              <tr>
                <th>{{ 'import.columns.file' | transloco }}</th>
                <th>{{ 'import.columns.status' | transloco }}</th>
                <th>{{ 'import.columns.note' | transloco }}</th>
              </tr>
            </thead>
            <tbody>
              @for (item of items(); track $index) {
                <tr>
                  <td>{{ item.filename }}</td>
                  <td>{{ 'import.status.' + item.status | transloco }}</td>
                  <td>
                    @if (noteKey(item); as key) {
                      {{ key | transloco }}
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
        @if (summary(); as s) {
          <p class="summary" data-testid="summary">{{ 'import.summary' | transloco: s }}</p>
        }
      </section>
    }

    <section data-testid="recent">
      <h2>{{ 'import.recentTitle' | transloco }}</h2>
      @if (recent().length === 0) {
        <p class="muted">{{ 'import.recentEmpty' | transloco }}</p>
      } @else {
        <ul class="plain">
          @for (r of recent(); track r.id) {
            <li class="recent-row" data-testid="recent-row">
              <span>{{ 'import.recentNumber' | transloco: { id: r.id } }}</span>
              <span class="muted">{{ dateLabel(r.created_at) }}</span>
              <span>{{ 'import.status.' + r.status | transloco }}</span>
              @if (r.status === 'processing' && followedId() !== r.id) {
                <button
                  mat-button
                  type="button"
                  [attr.data-testid]="'follow-' + r.id"
                  (click)="follow(r.id)"
                >
                  {{ 'import.follow' | transloco }}
                </button>
              }
            </li>
          }
        </ul>
      }
    </section>

    <section class="instructions" data-testid="instructions">
      <h2>{{ 'import.instructionsTitle' | transloco }}</h2>
      <h3>{{ 'import.instructionsSingleTitle' | transloco }}</h3>
      <p>{{ 'import.instructionsSingle' | transloco }}</p>
      <h3>{{ 'import.instructionsAllTitle' | transloco }}</h3>
      <p>{{ 'import.instructionsAll' | transloco }}</p>
    </section>
  `,
})
export class ImportPage {
  private readonly api = inject(ImportApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly transloco = inject(TranslocoService);

  protected readonly handset = toSignal(
    inject(BreakpointObserver)
      .observe(Breakpoints.Handset)
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );

  protected readonly selected = signal<File[]>([]);
  protected readonly skipped = signal<string[]>([]);
  protected readonly dragging = signal(false);
  protected readonly uploading = signal(false);
  protected readonly progress = signal(0);
  /** Falso finché non arriva un evento di progresso con il totale */
  protected readonly progressKnown = signal(false);
  /** Chiave Transloco dell'ultimo errore */
  protected readonly error = signal<string | null>(null);
  protected readonly recent = signal<ImportDto[]>([]);
  /** Import mostrato nella sezione esiti (appena caricato o seguito) */
  protected readonly current = signal<ImportDto | null>(null);
  /** Id dell'import in polling, null se nessuno */
  protected readonly followedId = signal<number | null>(null);

  protected readonly items = computed<ImportItem[]>(() => this.current()?.items ?? []);

  /** Riepilogo "N importate, N duplicate, N errori": solo a import concluso. */
  protected readonly summary = computed(() => {
    const imp = this.current();
    if (imp === null || imp.status === 'processing' || this.items().length === 0) return null;
    const count = (status: ImportItem['status']) =>
      this.items().filter((i) => i.status === status).length;
    return { imported: count('imported'), duplicates: count('duplicate'), failed: count('failed') };
  });

  protected readonly canUpload = computed(
    () => this.selected().length > 0 && !this.uploading() && this.followedId() === null,
  );

  private pollSub: Subscription | null = null;

  constructor() {
    this.loadRecent(true);
  }

  protected onDragOver(event: Event): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  protected onDrop(event: Event): void {
    event.preventDefault();
    this.dragging.set(false);
    this.addFiles((event as DragEvent).dataTransfer?.files);
  }

  protected onFilesChosen(input: HTMLInputElement): void {
    this.addFiles(input.files);
    // permette di riscegliere lo stesso file
    input.value = '';
  }

  protected remove(index: number): void {
    this.selected.update((files) => files.filter((_, i) => i !== index));
  }

  protected upload(): void {
    const files = this.selected();
    if (files.length === 0) return;
    this.error.set(null);
    this.current.set(null);
    this.progress.set(0);
    this.progressKnown.set(false);
    this.uploading.set(true);
    this.api
      .upload(files)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (event) => this.onUploadEvent(event),
        error: (err: unknown) => {
          this.uploading.set(false);
          this.error.set(uploadErrorKey(err));
          // 409: l'import in corso compare nei recenti, da seguire
          this.loadRecent(false);
        },
      });
  }

  /** Segue un import già avviato (es. quello in corso trovato tra i recenti). */
  protected follow(id: number): void {
    this.error.set(null);
    this.pollSub?.unsubscribe();
    this.followedId.set(id);
    this.pollSub = timer(0, POLL_INTERVAL_MS)
      .pipe(
        // exhaustMap: una GET lenta non viene annullata e non ne parte una seconda
        exhaustMap(() => this.api.get(id)),
        takeWhile((imp) => imp.status === 'processing', true),
        // `complete` sta prima di takeUntilDestroyed: alla distruzione non scatta
        tap({ complete: () => this.onPollDone() }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (imp) => this.current.set(imp),
        error: (err: unknown) => {
          this.followedId.set(null);
          this.error.set(errorKey(err));
        },
      });
  }

  protected noteKey(item: ImportItem): string | null {
    if (item.status === 'failed') {
      const key = `errors.${item.error_code ?? 'GENERIC'}`;
      // codice senza traduzione: messaggio generico (translate restituisce la chiave stessa)
      return this.transloco.translate(key) === key ? 'errors.GENERIC' : key;
    }
    if (item.status === 'duplicate') return 'import.duplicateNote';
    return null;
  }

  protected sizeLabel(bytes: number): string {
    const fmt = new Intl.NumberFormat(this.transloco.getActiveLang(), {
      maximumFractionDigits: 1,
    });
    if (bytes < 1024) return `${fmt.format(bytes)} B`;
    if (bytes < 1024 * 1024) return `${fmt.format(bytes / 1024)} KB`;
    return `${fmt.format(bytes / (1024 * 1024))} MB`;
  }

  protected dateLabel(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(this.transloco.getActiveLang(), {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(date);
  }

  private addFiles(list: FileList | File[] | null | undefined): void {
    if (!list) return;
    const accepted: File[] = [];
    const ignored: string[] = [];
    for (const file of Array.from(list)) {
      if (hasAllowedExtension(file.name)) accepted.push(file);
      else ignored.push(file.name);
    }
    this.skipped.set(ignored);
    if (accepted.length > 0) this.selected.update((files) => [...files, ...accepted]);
  }

  private onUploadEvent(event: HttpEvent<ImportDto>): void {
    if (event.type === HttpEventType.UploadProgress) {
      if (event.total) {
        this.progress.set(Math.round((event.loaded / event.total) * 100));
        this.progressKnown.set(true);
      }
    } else if (event.type === HttpEventType.Response) {
      this.uploading.set(false);
      this.selected.set([]);
      this.skipped.set([]);
      const imp = event.body;
      if (!imp) {
        // 202 senza corpo: l'import è partito, lo si ritrova (e segue) dai recenti
        this.loadRecent(true);
        return;
      }
      this.current.set(imp);
      if (imp.status === 'processing') this.follow(imp.id);
      else this.loadRecent(false);
    }
  }

  private onPollDone(): void {
    this.followedId.set(null);
    this.loadRecent(false);
  }

  /** Carica i recenti; al primo caricamento segue in automatico l'import in corso più recente. */
  private loadRecent(autoFollow: boolean): void {
    this.api
      .recent()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          const sorted = [...list].sort((a, b) => b.id - a.id);
          this.recent.set(sorted);
          const latest = sorted[0];
          if (autoFollow && latest?.status === 'processing' && this.followedId() === null) {
            this.follow(latest.id);
          }
        },
        error: (err: unknown) => this.error.set(errorKey(err)),
      });
  }
}
