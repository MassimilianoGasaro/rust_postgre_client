import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
  model,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DateAdapter, MAT_DATE_FORMATS, MAT_NATIVE_DATE_FORMATS } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { DateRange } from '../../core/api/models';
import {
  DEFAULT_PRESET,
  PRESETS,
  MAX_DATE,
  MIN_DATE,
  Preset,
  inBounds,
  parseIsoDate,
  presetRange,
  sameRange,
  toIsoDate,
} from '../../core/time/dates';
import { DATEPICKER_INTL_PROVIDER } from '../../core/i18n/transloco-datepicker-intl';
import { LocalDateAdapter } from '../../core/time/local-date-adapter';
import { TODAY } from '../../core/time/today';

/** Selettore dell'intervallo: preset (ultimi N giorni) o intervallo personalizzato. */
@Component({
  selector: 'app-date-range',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    TranslocoPipe,
  ],
  providers: [
    DATEPICKER_INTL_PROVIDER,
    { provide: DateAdapter, useClass: LocalDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: MAT_NATIVE_DATE_FORMATS },
  ],
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;
    }
    .presets {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .active {
      background: var(--mat-sys-secondary-container);
    }
  `,
  template: `
    <div class="presets" role="group" [attr.aria-label]="'dashboard.range.label' | transloco">
      @for (p of presets; track p) {
        <button
          mat-stroked-button
          type="button"
          [class.active]="active() === p"
          [attr.aria-pressed]="active() === p"
          [attr.data-testid]="'preset-' + p"
          (click)="select(p)"
        >
          {{ 'dashboard.range.' + p | transloco }}
        </button>
      }
      <button
        mat-stroked-button
        type="button"
        data-testid="preset-custom"
        [class.active]="active() === 'custom'"
        [attr.aria-pressed]="active() === 'custom'"
        (click)="customMode.set(true)"
      >
        {{ 'dashboard.range.custom' | transloco }}
      </button>
    </div>
    @if (active() === 'custom') {
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>{{ 'dashboard.range.dates' | transloco }}</mat-label>
        <mat-date-range-input [rangePicker]="picker" [min]="minDate" [max]="maxDate">
          <input
            matStartDate
            [placeholder]="'dashboard.range.from' | transloco"
            [value]="customStart()"
            (dateChange)="onStart($event.value)"
          />
          <input
            matEndDate
            [placeholder]="'dashboard.range.to' | transloco"
            [value]="customEnd()"
            (dateChange)="onEnd($event.value)"
          />
        </mat-date-range-input>
        <mat-datepicker-toggle matIconSuffix [for]="picker" />
        <mat-date-range-picker #picker />
      </mat-form-field>
    }
  `,
})
export class DateRangeComponent {
  /** Intervallo selezionato; se assente parte l'ultimo mese (preset 30d). */
  readonly value = model<DateRange>();

  private readonly today = inject(TODAY);
  private readonly adapter = inject<DateAdapter<Date>>(DateAdapter);
  private readonly transloco = inject(TranslocoService);

  protected readonly presets = PRESETS;
  protected readonly minDate = MIN_DATE;
  protected readonly maxDate = MAX_DATE;
  protected readonly customMode = signal(false);

  private readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  /** Preset che coincide con l'intervallo corrente, oppure `custom`. */
  protected readonly active = computed<Preset | 'custom'>(() => {
    const range = this.value();
    if (range === undefined || this.customMode()) return 'custom';
    const now = this.today();
    return PRESETS.find((p) => sameRange(presetRange(p, now), range)) ?? 'custom';
  });

  protected readonly customStart = linkedSignal(() => parseIsoDate(this.value()?.from));
  protected readonly customEnd = linkedSignal(() => parseIsoDate(this.value()?.to));

  constructor() {
    effect(() => {
      if (this.value() === undefined) {
        this.value.set(presetRange(DEFAULT_PRESET, this.today()));
      }
    });
    // i campi data seguono la lingua attiva
    effect(() => this.adapter.setLocale(this.lang()));
  }

  protected select(preset: Preset): void {
    this.customMode.set(false);
    this.value.set(presetRange(preset, this.today()));
  }

  /** Nuova data d'inizio: la fine va riscelta, l'intervallo non cambia finché non è completo. */
  protected onStart(date: Date | null): void {
    this.customStart.set(date);
    this.customEnd.set(null);
  }

  /** L'intervallo cambia solo quando la fine scelta è valida e non precede l'inizio. */
  protected onEnd(end: Date | null): void {
    this.customEnd.set(end);
    const start = this.customStart();
    if (start === null || end === null || start > end || !inBounds(start) || !inBounds(end)) return;
    // chi sceglie le date a mano resta in modalità personalizzata anche se coincidono con un preset
    this.customMode.set(true);
    this.value.set({ from: toIsoDate(start), to: toIsoDate(end) });
  }
}
