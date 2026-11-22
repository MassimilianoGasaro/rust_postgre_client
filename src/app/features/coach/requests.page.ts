import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Observable, finalize } from 'rxjs';
import { CoachLinkApi } from '../../core/api/coach-link-api';
import { errorKey } from '../../core/api/errors';
import { CoachLink } from '../../core/api/models';
import { PendingRequestsService } from '../../core/coach/pending-requests.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../shared/confirm-dialog.component';

/** Pagina /coach/requests: richieste di collegamento in attesa, da accettare o rifiutare. */
@Component({
  selector: 'app-requests-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, TranslocoPipe],
  styles: `
    :host {
      display: block;
      max-width: 720px;
      margin: 0 auto;
    }
    h1 {
      margin: 0 0 16px;
      font: var(--mat-sys-headline-medium);
    }
    .error {
      color: var(--mat-sys-error);
    }
    ul {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    li {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 8px 16px;
      padding: 8px 0;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }
    .actions {
      display: flex;
      gap: 8px;
    }
  `,
  template: `
    <h1>{{ 'coach.requests.title' | transloco }}</h1>

    @if (error()) {
      <p class="error" role="alert" data-testid="error">{{ error()! | transloco }}</p>
    }

    @if (requests() === null) {
      @if (!error()) {
        <p>{{ 'coach.requests.loading' | transloco }}</p>
      }
    } @else if (requests()!.length === 0) {
      <p data-testid="empty">{{ 'coach.requests.empty' | transloco }}</p>
    } @else {
      <ul>
        @for (link of requests(); track link.id) {
          <li data-testid="request-row">
            <span>
              {{
                'coach.requests.text'
                  | transloco: { athlete: link.athlete.username, date: date(link.requested_at) }
              }}
            </span>
            <span class="actions">
              <button
                mat-flat-button
                type="button"
                data-testid="accept"
                [disabled]="busy()"
                (click)="accept(link)"
              >
                {{ 'coach.requests.accept' | transloco }}
              </button>
              <button
                mat-stroked-button
                type="button"
                data-testid="reject"
                [disabled]="busy()"
                (click)="confirmReject(link)"
              >
                {{ 'coach.requests.reject' | transloco }}
              </button>
            </span>
          </li>
        }
      </ul>
    }
  `,
})
export class RequestsPage {
  private readonly api = inject(CoachLinkApi);
  private readonly dialog = inject(MatDialog);
  private readonly transloco = inject(TranslocoService);
  private readonly pending = inject(PendingRequestsService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  protected readonly requests = signal<CoachLink[] | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.reload();
  }

  protected date(iso: string): string {
    return new Intl.DateTimeFormat(this.lang(), { dateStyle: 'medium' }).format(new Date(iso));
  }

  protected accept(link: CoachLink): void {
    if (this.busy()) return;
    this.run(this.api.accept(link.id));
  }

  protected confirmReject(link: CoachLink): void {
    this.dialog
      .open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
        data: {
          title: 'coach.requests.rejectTitle',
          message: 'coach.requests.rejectMessage',
          confirm: 'coach.requests.reject',
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed === true && !this.busy()) this.run(this.api.reject(link.id));
      });
  }

  /**
   * Esegue l'azione e ricarica l'elenco anche se fallisce (la richiesta può essere cambiata nel
   * frattempo); l'errore resta visibile e `busy` dura fino a fine ricaricamento.
   */
  private run(action: Observable<CoachLink>): void {
    this.busy.set(true);
    this.error.set(null);
    action.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.reload(),
      error: (err: unknown) => {
        this.error.set(errorKey(err));
        this.reload();
      },
    });
  }

  private reload(): void {
    this.busy.set(true);
    this.api
      .list('pending')
      .pipe(
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (links) => {
          this.requests.set(links);
          // il badge del menu usa lo stesso elenco: nessuna richiesta in più
          this.pending.set(links.length);
        },
        error: (err: unknown) => this.error.update((current) => current ?? errorKey(err)),
      });
  }
}
