import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgxEchartsDirective } from 'ngx-echarts';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { ActivityApi } from '../../../core/api/activity-api';
import { errorKey } from '../../../core/api/errors';
import { Activity, DateRange } from '../../../core/api/models';
import { UserApi } from '../../../core/api/user-api';
import { ChartContext } from '../dashboard-charts';
import {
  bandOption,
  efficiencyOption,
  enduranceOption,
  formatEfficiency,
  formatMetric,
  paceHrOption,
} from './fitness-charts';
import {
  DEFAULT_BAND,
  HrBand,
  Kpi,
  bucketize,
  fitnessKpis,
  fitnessSportFor,
  granularityFor,
  hrBandFromProfile,
  metricFor,
  toPoints,
} from './fitness-metrics';

type Load =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'ok'; data: Activity[] }
  | { state: 'error'; key: string };

/** Limiti plausibili per una fascia di FC inserita a mano. */
const HR_MIN = 40;
const HR_MAX = 230;

interface KpiView {
  /** Chiave Transloco dell'etichetta e relativi parametri */
  label: string;
  params: Record<string, unknown>;
  value: string;
  delta: string | null;
  /** Il cambiamento va nella direzione buona per l'atleta? `null` = nessun cambiamento. */
  good: boolean | null;
}

/**
 * Sezione "Forma fisica": incrocia FC media e velocità delle attività del periodo
 * (passo/efficienza a parità di battito, resistenza nella fascia scelta).
 */
@Component({
  selector: 'app-fitness-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    NgxEchartsDirective,
    TranslocoPipe,
  ],
  styles: `
    :host {
      display: block;
      margin-top: 24px;
    }
    .head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    h2 {
      margin: 0;
      font: var(--mat-sys-title-large);
    }
    h3 {
      margin: 0;
      font: var(--mat-sys-title-medium);
    }
    .band {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .band mat-form-field {
      width: 96px;
    }
    .muted,
    .hint {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }
    .muted {
      margin: 4px 0 0;
    }
    .hint {
      margin: 2px 0 8px;
    }
    .kpis {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      margin-top: 12px;
    }
    .kpi,
    .panel {
      padding: 12px 16px;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 12px;
    }
    .kpi .label {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-label-medium);
    }
    .kpi .value {
      font: var(--mat-sys-headline-small);
    }
    .kpi .delta {
      font: var(--mat-sys-label-medium);
      color: var(--mat-sys-on-surface-variant);
    }
    .kpi .delta.good {
      color: #1a7f37;
    }
    .kpi .delta.bad {
      color: var(--mat-sys-error);
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-top: 12px;
    }
    .chart {
      height: 280px;
    }
    .empty,
    .error {
      margin-top: 12px;
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
    @media (max-width: 800px) {
      .grid {
        grid-template-columns: 1fr;
      }
    }
  `,
  template: `
    <section data-testid="fitness">
      <div class="head">
        <h2>{{ 'dashboard.fitness.title' | transloco }}</h2>
        @if (sport(); as s) {
          <div
            class="band"
            role="group"
            [attr.aria-label]="'dashboard.fitness.band.label' | transloco"
          >
            <span class="muted">{{ 'dashboard.fitness.band.label' | transloco }}</span>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>{{ 'dashboard.fitness.band.min' | transloco }}</mat-label>
              <input
                matInput
                type="number"
                inputmode="numeric"
                data-testid="band-min"
                [value]="band().min"
                (change)="onBand('min', $any($event.target))"
              />
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>{{ 'dashboard.fitness.band.max' | transloco }}</mat-label>
              <input
                matInput
                type="number"
                inputmode="numeric"
                data-testid="band-max"
                [value]="band().max"
                (change)="onBand('max', $any($event.target))"
              />
            </mat-form-field>
          </div>
        }
      </div>

      @if (sport(); as s) {
        <p class="muted" data-testid="fitness-scope">
          {{ 'dashboard.fitness.scope' | transloco: { sport: ('sport.' + s | transloco) } }}
          ·
          {{
            (profileBand() ? 'dashboard.fitness.band.fromProfile' : 'dashboard.fitness.band.manual')
              | transloco
          }}
        </p>

        @switch (load().state) {
          @case ('loading') {
            <mat-progress-bar
              mode="indeterminate"
              [attr.aria-label]="'dashboard.loading' | transloco"
            />
          }
          @case ('error') {
            <p class="error" role="alert" data-testid="fitness-error">
              {{ errorText() | transloco }}
            </p>
          }
          @case ('ok') {
            @if (points().length < 2) {
              <p class="empty" data-testid="fitness-empty">
                {{ 'dashboard.fitness.empty' | transloco }}
              </p>
            } @else {
              <section class="kpis" data-testid="fitness-kpis">
                @for (k of kpis(); track k.label) {
                  <div class="kpi">
                    <div class="label">{{ k.label | transloco: k.params }}</div>
                    <div class="value">{{ k.value }}</div>
                    @if (k.delta !== null) {
                      <div
                        class="delta"
                        [class.good]="k.good === true"
                        [class.bad]="k.good === false"
                      >
                        {{ k.delta }} {{ 'dashboard.fitness.kpi.vsFirstHalf' | transloco }}
                      </div>
                    }
                  </div>
                }
              </section>

              <section class="grid">
                <div class="panel">
                  <h3>{{ 'dashboard.fitness.efficiency.title' | transloco }}</h3>
                  <p class="hint">{{ 'dashboard.fitness.efficiency.hint' | transloco }}</p>
                  <div
                    echarts
                    class="chart"
                    data-testid="chart-efficiency"
                    [options]="efficiencyOptions()"
                  ></div>
                </div>
                <div class="panel">
                  <h3>{{ 'dashboard.fitness.paceHr.title.' + metric() | transloco }}</h3>
                  <p class="hint">{{ 'dashboard.fitness.paceHr.hint.' + metric() | transloco }}</p>
                  <div
                    echarts
                    class="chart"
                    data-testid="chart-pace-hr"
                    [options]="paceHrOptions()"
                  ></div>
                </div>
                <div class="panel">
                  <h3>{{ 'dashboard.fitness.band.title.' + metric() | transloco: band() }}</h3>
                  <p class="hint">{{ 'dashboard.fitness.band.hint.' + metric() | transloco }}</p>
                  <div
                    echarts
                    class="chart"
                    data-testid="chart-band"
                    [options]="bandOptions()"
                  ></div>
                </div>
                <div class="panel">
                  <h3>{{ 'dashboard.fitness.endurance.title' | transloco: band() }}</h3>
                  <p class="hint">{{ 'dashboard.fitness.endurance.hint' | transloco }}</p>
                  <div
                    echarts
                    class="chart"
                    data-testid="chart-endurance"
                    [options]="enduranceOptions()"
                  ></div>
                </div>
              </section>
            }
          }
        }
      } @else {
        <p class="empty" data-testid="fitness-unsupported">
          {{ 'dashboard.fitness.unsupported' | transloco }}
        </p>
      }
    </section>
  `,
})
export class FitnessSectionComponent {
  readonly range = input.required<DateRange>();
  /** Filtro sport della dashboard (`all` = tutti). */
  readonly sportFilter = input.required<string>();
  /** Atleta mostrato (vista coach); `null` = utente corrente. */
  readonly athleteId = input<number | null>(null);
  /** Lingua e traduzioni per i grafici (ricalcolato dalla dashboard al cambio lingua). */
  readonly ctx = input.required<ChartContext>();

  private readonly activityApi = inject(ActivityApi);
  private readonly userApi = inject(UserApi);

  protected readonly sport = computed(() => fitnessSportFor(this.sportFilter()));
  protected readonly metric = computed(() => {
    const s = this.sport();
    return s === null ? 'pace' : metricFor(s);
  });

  /** Zona 2 dal profilo: solo per l'utente corrente (il coach non legge il profilo dell'atleta). */
  protected readonly profileBand = toSignal(
    toObservable(this.athleteId).pipe(
      switchMap((id) =>
        id !== null
          ? of(null)
          : this.userApi.me().pipe(
              map((me) => hrBandFromProfile(me.profile.max_hr, me.profile.resting_hr)),
              catchError(() => of(null)),
            ),
      ),
    ),
    { initialValue: null },
  );

  protected readonly band = linkedSignal<HrBand>(() => this.profileBand() ?? DEFAULT_BAND);

  private readonly query = computed(() => ({
    range: this.range(),
    sport: this.sport(),
    athleteId: this.athleteId(),
  }));

  protected readonly load = toSignal(
    toObservable(this.query).pipe(
      switchMap((q) => {
        if (q.sport === null) return of<Load>({ state: 'idle' });
        return this.activityApi
          .listAll({ ...q.range, sport: q.sport, athlete_id: q.athleteId ?? undefined })
          .pipe(
            map((data): Load => ({ state: 'ok', data })),
            catchError((err: unknown) => of<Load>({ state: 'error', key: errorKey(err) })),
            startWith<Load>({ state: 'loading' }),
          );
      }),
    ),
    { initialValue: { state: 'loading' } as Load },
  );

  protected readonly errorText = computed(() => {
    const l = this.load();
    return l.state === 'error' ? l.key : '';
  });

  protected readonly points = computed(() => {
    const l = this.load();
    const s = this.sport();
    return l.state === 'ok' && s !== null ? toPoints(l.data, s) : [];
  });

  private readonly granularity = computed(() => granularityFor(this.range()));
  private readonly buckets = computed(() =>
    bucketize(this.points(), this.range(), this.granularity()),
  );

  protected readonly efficiencyOptions = computed(() =>
    efficiencyOption(this.points(), this.metric(), this.ctx()),
  );
  protected readonly paceHrOptions = computed(() =>
    paceHrOption(this.points(), this.range(), this.metric(), this.ctx()),
  );
  protected readonly bandOptions = computed(() =>
    bandOption(this.buckets(), this.band(), this.granularity(), this.metric(), this.ctx()),
  );
  protected readonly enduranceOptions = computed(() =>
    enduranceOption(this.buckets(), this.band(), this.granularity(), this.ctx()),
  );

  protected readonly kpis = computed<KpiView[]>(() => {
    const { lang } = this.ctx();
    const metric = this.metric();
    const band = this.band();
    const k = fitnessKpis(this.points(), this.range(), band, metric);
    const signed = (n: number, text: string) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${text}`;
    const view = (
      label: string,
      params: Record<string, unknown>,
      kpi: Kpi | null,
      value: (v: number) => string,
      delta: (d: number) => string,
      higherIsBetter: boolean,
    ): KpiView => ({
      label,
      params,
      value: kpi === null ? '—' : value(kpi.value),
      delta:
        kpi === null || kpi.delta === null ? null : signed(kpi.delta, delta(Math.abs(kpi.delta))),
      good:
        kpi === null || kpi.delta === null || kpi.delta === 0
          ? null
          : kpi.delta > 0 === higherIsBetter,
    });
    const num = (digits: number) =>
      new Intl.NumberFormat(lang, { minimumFractionDigits: digits, maximumFractionDigits: digits });
    return [
      view(
        `dashboard.fitness.kpi.band.${metric}`,
        { ...band },
        k.bandMetric,
        (v) => formatMetric(v, metric, lang),
        (d) => (metric === 'pace' ? `${Math.round(d)} s/km` : `${num(1).format(d)} km/h`),
        metric === 'speed',
      ),
      view(
        'dashboard.fitness.kpi.efficiency',
        {},
        k.efficiency,
        (v) => formatEfficiency(v, lang),
        (d) => num(2).format(d),
        true,
      ),
      view(
        'dashboard.fitness.kpi.longest',
        { ...band },
        k.longestInBand,
        (v) => `${Math.round(v / 60)} min`,
        (d) => `${Math.round(d / 60)} min`,
        true,
      ),
    ];
  });

  /** Aggiorna un estremo della fascia; valori non validi ripristinano quello attuale. */
  protected onBand(edge: keyof HrBand, el: HTMLInputElement): void {
    const value = Math.round(Number(el.value));
    const next = { ...this.band(), [edge]: value };
    if (
      el.value.trim() === '' ||
      !Number.isFinite(value) ||
      value < HR_MIN ||
      value > HR_MAX ||
      next.min >= next.max
    ) {
      el.value = String(this.band()[edge]);
      return;
    }
    this.band.set(next);
  }
}
