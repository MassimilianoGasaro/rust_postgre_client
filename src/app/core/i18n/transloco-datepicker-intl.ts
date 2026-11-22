import { DestroyRef, inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDatepickerIntl } from '@angular/material/datepicker';
import { TranslocoService } from '@jsverse/transloco';
import { switchMap } from 'rxjs';

/** Etichette del calendario Material tradotte con Transloco, aggiornate al cambio lingua. */
@Injectable()
export class TranslocoDatepickerIntl extends MatDatepickerIntl {
  private readonly transloco = inject(TranslocoService);

  constructor() {
    super();
    // `load` attende il caricamento del file di traduzione della lingua attiva
    this.transloco.langChanges$
      .pipe(
        switchMap((lang) => this.transloco.load(lang)),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe(() => this.refresh());
  }

  private refresh(): void {
    const t = (key: string) => this.transloco.translate(`datepicker.${key}`);
    this.calendarLabel = t('calendar');
    this.openCalendarLabel = t('open');
    this.closeCalendarLabel = t('close');
    this.prevMonthLabel = t('prevMonth');
    this.nextMonthLabel = t('nextMonth');
    this.prevYearLabel = t('prevYear');
    this.nextYearLabel = t('nextYear');
    this.prevMultiYearLabel = t('prevMultiYear');
    this.nextMultiYearLabel = t('nextMultiYear');
    this.switchToMonthViewLabel = t('switchToMonth');
    this.switchToMultiYearViewLabel = t('switchToMultiYear');
    this.changes.next();
  }
}

/**
 * Provider da mettere nei componenti che usano il calendario: `MatDatepickerModule` registra una
 * propria `MatDatepickerIntl` nell'injector del componente, che prevale su quella globale.
 */
export const DATEPICKER_INTL_PROVIDER = {
  provide: MatDatepickerIntl,
  useClass: TranslocoDatepickerIntl,
};
