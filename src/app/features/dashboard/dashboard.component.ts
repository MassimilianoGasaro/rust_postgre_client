import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NgxEchartsDirective } from 'ngx-echarts';
import {
  Observable,
  asapScheduler,
  catchError,
  filter,
  map,
  merge,
  observeOn,
  of,
  scan,
  switchMap,
  tap,
} from 'rxjs';
import { ActivityApi } from '../../core/api/activity-api';
import { errorKey } from '../../core/api/errors';
import { Activity, DateRange, Page, StatsSummary } from '../../core/api/models';
import { StatsApi } from '../../core/api/stats-api';
import { DistanceKmPipe, DurationPipe } from '../../core/format/format.pipes';
import { DEFAULT_PRESET, parseIsoDate, presetRange, sameRange } from '../../core/time/dates';
import { TODAY } from '../../core/time/today';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../shared/confirm-dialog.component';
import { formatActivityStart, formatElevation, formatHeartRate } from './activity-format';
import { barOption, donutOption } from './dashboard-charts';
import { DateRangeComponent } from './date-range.component';

/** Sport normalizzati dal backend (più "all" = nessun filtro). */
const SPORTS = ['running', 'cycling', 'swimming', 'walking', 'hiking', 'strength', 'other'];
const ALL = 'all';
const PER_PAGE = 10;

interface Row {
  activity: Activity;
  /** Data/ora già formattata nella lingua attiva */
  when: string;
}

type Loaded<T> = { ok: true; data: T } | { ok: false; error: unknown };

const settled = <T>(source: Observable<T>) =>
  source.pipe(
    map((data): Loaded<T> => ({ ok: true, data })),
    catchError((error: unknown) => of<Loaded<T>>({ ok: false, error })),
  );

/**
 * Dashboard di un atleta: intervallo di date, totali, grafici e elenco attività.
 * Riutilizzabile: `athleteId` (vista del coach) e `readOnly` (nessuna modifica).
 */
@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    NgxEchartsDirective,
    TranslocoPipe,
    DistanceKmPipe,
    DurationPipe,
    DateRangeComponent,
  ],
  styles: `
    :host {
      display: block;
      max-width: 1100px;
      margin: 0 auto;
    }
    h2 {
      margin: 24px 0 8px;
      font: var(--mat-sys-title-medium);
    }
    .filters {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .totals {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 12px;
      margin-top: 16px;
    }
    .total,
    .panel,
    .card {
      padding: 12px 16px;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 12px;
    }
    .total .label,
    .muted {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-label-medium);
    }
    .total .value {
      font: var(--mat-sys-headline-small);
    }
    .charts {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 12px;
      margin-top: 12px;
    }
    .charts h2 {
      margin-top: 0;
    }
    .chart {
      height: 300px;
    }
    .empty,
    .error {
      margin-top: 16px;
      padding: 16px;
      border-radius: 12px;
    }
    .empty {
      background: var(--mat-sys-surface-container);
    }
    .error {
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
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
    td.num,
    th.num {
      text-align: right;
    }
    .card {
      margin-bottom: 8px;
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 4px 12px;
    }
    .card .sport {
      font: var(--mat-sys-label-large);
    }
    .card .metrics {
      grid-column: 1 / -1;
      display: flex;
      flex-wrap: wrap;
      gap: 4px 16px;
    }
    .pager {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-top: 8px;
    }
    @media (max-width: 800px) {
      .charts {
        grid-template-columns: 1fr;
      }
    }
  `,
  template: `
    <section class="filters">
      <app-date-range [value]="range()" (valueChange)="onRange($event)" />
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>{{ 'dashboard.sport.label' | transloco }}</mat-label>
        <select
          matNativeControl
          data-testid="sport-filter"
          [value]="sport()"
          (change)="onSport($any($event.target).value)"
        >
          <option value="all">{{ 'dashboard.sport.all' | transloco }}</option>
          @for (s of sports; track s) {
            <option [value]="s" [selected]="sport() === s">{{ 'sport.' + s | transloco }}</option>
          }
        </select>
      </mat-form-field>
    </section>

    @if (loading()) {
      <mat-progress-bar mode="indeterminate" [attr.aria-label]="'dashboard.loading' | transloco" />
    }

    @if (error(); as key) {
      <p class="error" role="alert" data-testid="error">{{ key | transloco }}</p>
    }

    @if (stats(); as s) {
      @if (s.totals.count === 0) {
        <div class="empty" data-testid="empty-state">
          <p>{{ 'dashboard.empty' | transloco }}</p>
          @if (!readOnly()) {
            <a mat-flat-button routerLink="/import" data-testid="empty-import-link">
              {{ 'dashboard.emptyImport' | transloco }}
            </a>
          }
        </div>
      } @else {
        <section class="totals" data-testid="totals">
          <div class="total">
            <div class="label">{{ 'dashboard.totals.count' | transloco }}</div>
            <div class="value">{{ s.totals.count }}</div>
          </div>
          <div class="total">
            <div class="label">{{ 'dashboard.totals.distance' | transloco }}</div>
            <div class="value">{{ s.totals.distance_m | distanceKm }}</div>
          </div>
          <div class="total">
            <div class="label">{{ 'dashboard.totals.movingTime' | transloco }}</div>
            <div class="value">{{ s.totals.moving_s | duration }}</div>
          </div>
          <div class="total">
            <div class="label">{{ 'dashboard.totals.elevation' | transloco }}</div>
            <div class="value">{{ elevationTotal() }}</div>
          </div>
        </section>

        <section class="charts">
          <div class="panel">
            <h2>{{ 'dashboard.chart.distanceTitle' | transloco }}</h2>
            <div echarts class="chart" data-testid="chart-bar" [options]="barOptions()"></div>
          </div>
          <div class="panel">
            <h2>{{ 'dashboard.chart.sportTitle' | transloco }}</h2>
            <div echarts class="chart" data-testid="chart-donut" [options]="donutOptions()"></div>
          </div>
        </section>
      }
    }

    @if (activities(); as list) {
      @if (list.total > 0) {
        <h2>{{ 'dashboard.list.title' | transloco }}</h2>
        @if (handset()) {
          @for (row of rows(); track row.activity.id) {
            <div class="card" data-testid="activity-card">
              <div>
                <div class="sport">{{ 'sport.' + row.activity.sport | transloco }}</div>
                <div class="muted">{{ row.when }}</div>
              </div>
              @if (!readOnly()) {
                <button
                  mat-icon-button
                  type="button"
                  [attr.data-testid]="'delete-' + row.activity.id"
                  [attr.aria-label]="'dashboard.list.delete' | transloco"
                  [disabled]="deletingId() === row.activity.id"
                  (click)="confirmDelete(row.activity)"
                >
                  <mat-icon>delete</mat-icon>
                </button>
              }
              <div class="metrics">
                <span>{{ row.activity.distance_m | distanceKm }}</span>
                <span>{{ row.activity.moving_s ?? row.activity.elapsed_s | duration }}</span>
                <span>{{ elevation(row.activity.elevation_gain_m) }}</span>
                <span
                  >{{ 'dashboard.list.avgHr' | transloco }}
                  {{ heartRate(row.activity.avg_hr) }}</span
                >
              </div>
            </div>
          }
        } @else {
          <table>
            <thead>
              <tr>
                <th>{{ 'dashboard.list.date' | transloco }}</th>
                <th>{{ 'dashboard.list.sport' | transloco }}</th>
                <th class="num">{{ 'dashboard.list.distance' | transloco }}</th>
                <th class="num">{{ 'dashboard.list.duration' | transloco }}</th>
                <th class="num">{{ 'dashboard.list.elevation' | transloco }}</th>
                <th class="num">{{ 'dashboard.list.avgHr' | transloco }}</th>
                @if (!readOnly()) {
                  <th></th>
                }
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.activity.id) {
                <tr data-testid="activity-row">
                  <td>{{ row.when }}</td>
                  <td>{{ 'sport.' + row.activity.sport | transloco }}</td>
                  <td class="num">{{ row.activity.distance_m | distanceKm }}</td>
                  <td class="num">
                    {{ row.activity.moving_s ?? row.activity.elapsed_s | duration }}
                  </td>
                  <td class="num">{{ elevation(row.activity.elevation_gain_m) }}</td>
                  <td class="num">{{ heartRate(row.activity.avg_hr) }}</td>
                  @if (!readOnly()) {
                    <td class="num">
                      <button
                        mat-icon-button
                        type="button"
                        [attr.data-testid]="'delete-' + row.activity.id"
                        [attr.aria-label]="'dashboard.list.delete' | transloco"
                        [disabled]="deletingId() === row.activity.id"
                        (click)="confirmDelete(row.activity)"
                      >
                        <mat-icon>delete</mat-icon>
                      </button>
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        }
        @if (pages() > 1) {
          <nav class="pager" data-testid="pager">
            <button
              mat-icon-button
              type="button"
              data-testid="prev-page"
              [attr.aria-label]="'dashboard.list.prev' | transloco"
              [disabled]="page() <= 1"
              (click)="goTo(page() - 1)"
            >
              <mat-icon>chevron_left</mat-icon>
            </button>
            <span>{{ 'dashboard.list.pageOf' | transloco: { page: page(), pages: pages() } }}</span>
            <button
              mat-icon-button
              type="button"
              data-testid="next-page"
              [attr.aria-label]="'dashboard.list.next' | transloco"
              [disabled]="page() >= pages()"
              (click)="goTo(page() + 1)"
            >
              <mat-icon>chevron_right</mat-icon>
            </button>
          </nav>
        }
      }
    }
  `,
})
export class DashboardComponent {
  /** Atleta da mostrare (vista del coach); `null` = l'utente corrente. */
  readonly athleteId = input<number | null>(null);
  /** Nasconde le azioni che modificano i dati (elimina, link all'import). */
  readonly readOnly = input<boolean>(false);
  /** Emesso quando il backend risponde 403 ATHLETE_ACCESS_DENIED. */
  readonly accessDenied = output<void>();

  private readonly statsApi = inject(StatsApi);
  private readonly activityApi = inject(ActivityApi);
  private readonly transloco = inject(TranslocoService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly today = inject(TODAY);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly sports = SPORTS;

  protected readonly handset = toSignal(
    inject(BreakpointObserver)
      .observe(Breakpoints.Handset)
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );

  protected readonly range = signal<DateRange>(this.initialRange());
  protected readonly sport = signal<string>(this.initialSport());
  protected readonly page = signal(1);
  /** Incrementato per ricaricare statistiche ed elenco (es. dopo un'eliminazione). */
  private readonly reloadTick = signal(0);

  protected readonly stats = signal<StatsSummary | null>(null);
  protected readonly activities = signal<Page<Activity> | null>(null);
  private readonly statsError = signal<string | null>(null);
  private readonly listError = signal<string | null>(null);
  private readonly statsLoading = signal(true);
  private readonly listLoading = signal(true);
  protected readonly deletingId = signal<number | null>(null);

  protected readonly loading = computed(() => this.statsLoading() || this.listLoading());
  /** Chiave Transloco del primo errore di caricamento. */
  protected readonly error = computed(() => this.statsError() ?? this.listError());
  protected readonly pages = computed(() => {
    const list = this.activities();
    return list === null ? 0 : Math.ceil(list.total / PER_PAGE);
  });

  /** Cambia a ogni cambio lingua o caricamento di traduzioni: fa ricalcolare grafici ed elenco. */
  private readonly i18nTick = toSignal(
    merge(
      this.transloco.langChanges$,
      // il caricamento può avvenire durante il rendering: la scrittura sul signal va rimandata
      this.transloco.events$.pipe(
        filter((e) => e.type === 'translationLoadSuccess'),
        observeOn(asapScheduler),
      ),
    ).pipe(scan((n) => n + 1, 0)),
    { initialValue: 0 },
  );

  private readonly chartContext = computed(() => {
    this.i18nTick();
    return {
      lang: this.transloco.getActiveLang(),
      t: (key: string) => this.transloco.translate(key),
    };
  });

  protected readonly barOptions = computed(() => {
    const s = this.stats();
    return s === null ? {} : barOption(s, this.chartContext());
  });
  protected readonly donutOptions = computed(() => {
    const s = this.stats();
    return s === null ? {} : donutOption(s, this.chartContext());
  });
  protected readonly elevationTotal = computed(() =>
    formatElevation(this.stats()?.totals.elevation_gain_m),
  );

  protected readonly rows = computed<Row[]>(() => {
    const lang = this.chartContext().lang;
    return (this.activities()?.items ?? []).map((activity) => ({
      activity,
      when: formatActivityStart(activity.start_time, activity.utc_offset_seconds, lang),
    }));
  });

  private readonly statsQuery = computed(() => ({
    range: this.range(),
    sport: this.sport(),
    athleteId: this.athleteId(),
    tick: this.reloadTick(),
  }));

  private readonly listQuery = computed(() => ({ ...this.statsQuery(), page: this.page() }));

  constructor() {
    toObservable(this.statsQuery)
      .pipe(
        tap(() => this.statsLoading.set(true)),
        switchMap((q) =>
          settled(
            this.statsApi.summary(q.range, {
              sport: q.sport === ALL ? undefined : q.sport,
              athlete_id: q.athleteId ?? undefined,
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((result) => {
        this.statsLoading.set(false);
        if (result.ok) {
          this.stats.set(result.data);
          this.statsError.set(null);
        } else {
          this.stats.set(null);
          this.statsError.set(this.reportError(result.error));
        }
      });

    toObservable(this.listQuery)
      .pipe(
        tap(() => this.listLoading.set(true)),
        switchMap((q) =>
          settled(
            this.activityApi.list({
              ...q.range,
              sport: q.sport === ALL ? undefined : q.sport,
              athlete_id: q.athleteId ?? undefined,
              page: q.page,
              per_page: PER_PAGE,
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((result) => {
        this.listLoading.set(false);
        if (result.ok) {
          this.activities.set(result.data);
          this.listError.set(null);
        } else {
          this.activities.set(null);
          this.listError.set(this.reportError(result.error));
        }
      });
  }

  protected onRange(next: DateRange | undefined): void {
    if (next === undefined || sameRange(next, this.range())) return;
    this.range.set(next);
    this.page.set(1);
    this.syncUrl();
  }

  protected onSport(value: string): void {
    if (value === this.sport()) return;
    this.sport.set(value);
    this.page.set(1);
    this.syncUrl();
  }

  protected goTo(page: number): void {
    if (page >= 1 && page <= this.pages()) this.page.set(page);
  }

  protected readonly elevation = formatElevation;
  protected readonly heartRate = formatHeartRate;

  protected confirmDelete(activity: Activity): void {
    this.dialog
      .open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
        data: {
          title: 'dashboard.delete.title',
          message: 'dashboard.delete.message',
          confirm: 'dashboard.list.delete',
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed === true) this.remove(activity);
      });
  }

  private remove(activity: Activity): void {
    this.deletingId.set(activity.id);
    this.activityApi
      .delete(activity.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deletingId.set(null);
          // eliminata l'ultima attività dell'ultima pagina: si torna alla pagina precedente
          if (this.page() > 1 && this.activities()?.items.length === 1) {
            this.page.update((p) => p - 1);
          }
          this.reloadTick.update((n) => n + 1);
        },
        error: (err: unknown) => {
          this.deletingId.set(null);
          this.snackBar.open(
            this.transloco.translate(errorKey(err)),
            this.transloco.translate('common.close'),
            { duration: 6000 },
          );
        },
      });
  }

  /** Restituisce la chiave dell'errore; su 403 ATHLETE_ACCESS_DENIED avvisa anche il chiamante. */
  private reportError(err: unknown): string {
    const key = errorKey(err);
    if (
      err instanceof HttpErrorResponse &&
      err.status === 403 &&
      key === 'errors.ATHLETE_ACCESS_DENIED'
    ) {
      this.accessDenied.emit();
    }
    return key;
  }

  /** Riporta intervallo e sport nell'URL, così ricaricare la pagina mantiene la vista. */
  private syncUrl(): void {
    const { from, to } = this.range();
    const sport = this.sport();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { from, to, sport: sport === ALL ? null : sport },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private initialRange(): DateRange {
    const params = this.route.snapshot.queryParamMap;
    const from = params.get('from');
    const to = params.get('to');
    const start = parseIsoDate(from);
    const end = parseIsoDate(to);
    if (from !== null && to !== null && start !== null && end !== null && start <= end) {
      return { from, to };
    }
    return presetRange(DEFAULT_PRESET, this.today());
  }

  private initialSport(): string {
    const sport = this.route.snapshot.queryParamMap.get('sport');
    return sport !== null && SPORTS.includes(sport) ? sport : ALL;
  }
}
