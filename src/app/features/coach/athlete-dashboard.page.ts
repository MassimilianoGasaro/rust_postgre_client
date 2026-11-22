import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { map } from 'rxjs';
import { CoachLinkApi } from '../../core/api/coach-link-api';
import { errorKey } from '../../core/api/errors';
import { LinkedAthlete } from '../../core/api/models';
import { DashboardComponent } from '../dashboard/dashboard.component';

/** Pagina /coach/athletes/:id: dashboard in sola lettura di un atleta seguito dal coach. */
@Component({
  selector: 'app-athlete-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DashboardComponent, RouterLink, TranslocoPipe],
  styles: `
    .head {
      max-width: 1100px;
      margin: 0 auto 16px;
    }
    h1 {
      margin: 0;
      font: var(--mat-sys-headline-medium);
    }
    .error {
      color: var(--mat-sys-error);
    }
  `,
  template: `
    <div class="head">
      <a routerLink="/coach/athletes" data-testid="back">{{ 'coach.athlete.back' | transloco }}</a>
      @if (athlete(); as a) {
        <h1>{{ 'coach.athlete.title' | transloco: { athlete: a.username } }}</h1>
      }
      @if (error()) {
        <p class="error" role="alert" data-testid="error">{{ error()! | transloco }}</p>
      } @else if (athletes() === null) {
        <p>{{ 'coach.athlete.loading' | transloco }}</p>
      }
    </div>
    <!-- Un solo elemento chiave: cambiando atleta la dashboard viene ricreata e riparte dai default
         (intervallo, sport, pagina), senza ereditare lo stato dell'atleta precedente. -->
    @for (id of dashboardIds(); track id) {
      <app-dashboard [athleteId]="id" [readOnly]="true" (accessDenied)="deny()" />
    }
  `,
})
export class AthleteDashboardPage {
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly transloco = inject(TranslocoService);

  /** Id dalla rotta; null se non è un intero positivo. */
  private readonly athleteId = toSignal(
    inject(ActivatedRoute).paramMap.pipe(
      map((params) => {
        const raw = params.get('id') ?? '';
        const id = /^\d+$/.test(raw) ? Number(raw) : NaN;
        return Number.isSafeInteger(id) && id > 0 ? id : null;
      }),
    ),
    { initialValue: null },
  );

  protected readonly athletes = signal<LinkedAthlete[] | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly athlete = computed(
    () => this.athletes()?.find((a) => a.id === this.athleteId()) ?? null,
  );

  /** La dashboard si monta solo per un atleta attivo: niente richieste destinate al 403. */
  protected readonly dashboardIds = computed(() => {
    const athlete = this.athlete();
    return athlete === null ? [] : [athlete.id];
  });

  constructor() {
    inject(CoachLinkApi)
      .athletes()
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe({
        next: (athletes) => this.athletes.set(athletes),
        error: (err: unknown) => this.error.set(errorKey(err)),
      });

    // atleta non tra quelli attivi (id non valido, collegamento revocato, ...): accesso negato
    effect(() => {
      if (this.athletes() !== null && this.athlete() === null) this.deny();
    });
  }

  protected deny(): void {
    this.snackBar.open(
      this.transloco.translate('errors.ATHLETE_ACCESS_DENIED'),
      this.transloco.translate('common.close'),
      { duration: 6000 },
    );
    void this.router.navigate(['/coach/athletes']);
  }
}
