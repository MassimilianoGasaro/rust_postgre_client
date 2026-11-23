import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { CoachLinkApi } from '../../core/api/coach-link-api';
import { errorKey } from '../../core/api/errors';
import { LinkedAthlete } from '../../core/api/models';
import { mediumDate } from '../../core/format/medium-date';

/** Pagina /coach/athletes: atleti attivi, ciascuno porta alla sua dashboard. */
@Component({
  selector: 'app-athletes-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoPipe],
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
    a {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 4px 16px;
      padding: 12px 0;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
      color: inherit;
      text-decoration: none;
    }
    a:hover,
    a:focus-visible {
      background: var(--mat-sys-surface-container);
    }
    .meta {
      color: var(--mat-sys-on-surface-variant);
    }
  `,
  template: `
    <h1>{{ 'coach.athletes.title' | transloco }}</h1>

    @if (error()) {
      <p class="error" role="alert" data-testid="error">{{ error()! | transloco }}</p>
    } @else if (athletes() === null) {
      <p>{{ 'coach.athletes.loading' | transloco }}</p>
    } @else if (athletes()!.length === 0) {
      <p data-testid="empty">{{ 'coach.athletes.empty' | transloco }}</p>
    } @else {
      <ul>
        @for (athlete of athletes(); track athlete.id) {
          <li>
            <a [routerLink]="['/coach/athletes', athlete.id]" data-testid="athlete-item">
              <span>{{ athlete.username }}</span>
              <span class="meta">
                {{ 'coach.athletes.since' | transloco: { date: date(athlete.linked_since) } }}
              </span>
            </a>
          </li>
        }
      </ul>
    }
  `,
})
export class AthletesPage {
  private readonly transloco = inject(TranslocoService);

  private readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  protected readonly athletes = signal<LinkedAthlete[] | null>(null);
  protected readonly error = signal<string | null>(null);

  constructor() {
    inject(CoachLinkApi)
      .athletes()
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe({
        next: (athletes) => this.athletes.set(athletes),
        error: (err: unknown) => this.error.set(errorKey(err)),
      });
  }

  protected date(iso: string): string {
    return mediumDate(iso, this.lang());
  }
}
