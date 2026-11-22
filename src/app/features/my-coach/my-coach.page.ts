import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Observable } from 'rxjs';
import { errorKey } from '../../core/api/errors';
import { CoachLink } from '../../core/api/models';
import { CoachLinkApi } from '../../core/api/coach-link-api';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../shared/confirm-dialog.component';

/** Data di chiusura (o, in mancanza, di risposta/richiesta) per ordinare lo storico. */
const closedAt = (l: CoachLink) => l.ended_at ?? l.responded_at ?? l.requested_at;

@Component({
  selector: 'app-my-coach-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    TranslocoPipe,
  ],
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
    h2 {
      margin: 0 0 12px;
      font: var(--mat-sys-title-medium);
    }
    section {
      margin-bottom: 24px;
    }
    form {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0 12px;
    }
    mat-form-field {
      flex: 1 1 260px;
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
      justify-content: space-between;
      gap: 4px 16px;
      padding: 8px 0;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }
    .meta {
      color: var(--mat-sys-on-surface-variant);
    }
  `,
  template: `
    <h1>{{ 'myCoach.title' | transloco }}</h1>

    @if (error()) {
      <p class="error" role="alert" data-testid="error">{{ error()! | transloco }}</p>
    }

    @if (links() === null) {
      @if (!error()) {
        <p>{{ 'myCoach.loading' | transloco }}</p>
      }
    } @else {
      @if (current(); as link) {
        @if (link.status === 'pending') {
          <section data-testid="pending">
            <h2>{{ 'myCoach.pending.title' | transloco }}</h2>
            <p>
              {{
                'myCoach.pending.text'
                  | transloco: { coach: link.coach.username, date: date(link.requested_at) }
              }}
            </p>
            <button
              mat-stroked-button
              type="button"
              data-testid="cancel-request"
              [disabled]="busy()"
              (click)="cancel(link)"
            >
              {{ 'myCoach.pending.cancel' | transloco }}
            </button>
          </section>
        } @else {
          <section data-testid="active">
            <h2>{{ 'myCoach.active.title' | transloco }}</h2>
            <p>
              {{
                'myCoach.active.text'
                  | transloco
                    : {
                        coach: link.coach.username,
                        date: date(link.responded_at ?? link.requested_at),
                      }
              }}
            </p>
            <button
              mat-stroked-button
              type="button"
              data-testid="revoke"
              [disabled]="busy()"
              (click)="confirmRevoke(link)"
            >
              {{ 'myCoach.active.revoke' | transloco }}
            </button>
          </section>
        }
      } @else {
        <section>
          <h2>{{ 'myCoach.request.title' | transloco }}</h2>
          <form (submit)="$event.preventDefault(); request()">
            <mat-form-field appearance="outline">
              <mat-label>{{ 'myCoach.request.label' | transloco }}</mat-label>
              <input
                matInput
                type="text"
                autocomplete="off"
                data-testid="coach-input"
                [formControl]="coach"
              />
            </mat-form-field>
            <button
              mat-flat-button
              type="submit"
              data-testid="send"
              [disabled]="coach.value.trim() === '' || busy()"
            >
              {{ 'myCoach.request.send' | transloco }}
            </button>
          </form>
        </section>
      }

      @if (history().length > 0) {
        <section data-testid="history">
          <h2>{{ 'myCoach.history.title' | transloco }}</h2>
          <ul>
            @for (link of history(); track link.id) {
              <li data-testid="history-item">
                <span>{{ link.coach.username }}</span>
                <span class="meta">
                  {{ 'myCoach.status.' + link.status | transloco }} · {{ date(closedDate(link)) }}
                </span>
              </li>
            }
          </ul>
        </section>
      }
    }
  `,
})
export class MyCoachPage {
  private readonly api = inject(CoachLinkApi);
  private readonly dialog = inject(MatDialog);
  private readonly transloco = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  protected readonly coach = new FormControl('', { nonNullable: true });
  protected readonly links = signal<CoachLink[] | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly closedDate = closedAt;

  /** Il collegamento aperto (in attesa o attivo): il backend ne ammette uno solo. */
  protected readonly current = computed(
    () => this.links()?.find((l) => l.status === 'pending' || l.status === 'active') ?? null,
  );

  /** Collegamenti chiusi (rifiutati, annullati, revocati), dal più recente. */
  protected readonly history = computed(() =>
    (this.links() ?? [])
      .filter((l) => l.status !== 'pending' && l.status !== 'active')
      .sort((a, b) => Date.parse(closedAt(b)) - Date.parse(closedAt(a))),
  );

  constructor() {
    this.reload();
  }

  protected date(iso: string): string {
    return new Intl.DateTimeFormat(this.lang(), { dateStyle: 'medium' }).format(new Date(iso));
  }

  protected request(): void {
    const coach = this.coach.value.trim();
    if (coach === '' || this.busy()) return;
    this.run(this.api.request(coach), () => this.coach.reset(''));
  }

  protected cancel(link: CoachLink): void {
    if (this.busy()) return;
    this.run(this.api.cancel(link.id));
  }

  protected confirmRevoke(link: CoachLink): void {
    this.dialog
      .open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
        data: {
          title: 'myCoach.active.revokeTitle',
          message: 'myCoach.active.revokeMessage',
          confirm: 'myCoach.active.revoke',
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed === true && !this.busy()) this.run(this.api.revoke(link.id));
      });
  }

  /** Esegue un'azione sul collegamento e, riuscita, ricarica l'elenco. */
  private run(action: Observable<CoachLink>, onSuccess?: () => void): void {
    this.busy.set(true);
    this.error.set(null);
    action.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        onSuccess?.();
        this.busy.set(false);
        this.reload();
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.error.set(errorKey(err));
      },
    });
  }

  private reload(): void {
    this.api
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (links) => this.links.set(links),
        error: (err: unknown) => this.error.set(errorKey(err)),
      });
  }
}
