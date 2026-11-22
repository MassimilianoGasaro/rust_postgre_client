import { inject, Pipe, PipeTransform } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

const MISSING = '—';

/** Metri -> "12,3 km" / "12.3 km" secondo la lingua attiva (impura: si aggiorna al cambio lingua). */
@Pipe({ name: 'distanceKm', pure: false })
export class DistanceKmPipe implements PipeTransform {
  private readonly transloco = inject(TranslocoService);
  private formatter: Intl.NumberFormat | null = null;
  private formatterLang = '';

  transform(meters: number | null | undefined): string {
    if (meters === null || meters === undefined || !Number.isFinite(meters)) return MISSING;
    const lang = this.transloco.getActiveLang();
    if (this.formatter === null || this.formatterLang !== lang) {
      this.formatter = new Intl.NumberFormat(lang, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      });
      this.formatterLang = lang;
    }
    return `${this.formatter.format(meters / 1000)} km`;
  }
}

/** Secondi -> "m:ss" sotto l'ora, "h:mm" da un'ora in su. */
@Pipe({ name: 'duration' })
export class DurationPipe implements PipeTransform {
  transform(seconds: number | null | undefined): string {
    if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return MISSING;
    const total = Math.round(Math.max(0, seconds));
    const pad = (n: number) => String(n).padStart(2, '0');
    if (total >= 3600) {
      return `${Math.floor(total / 3600)}:${pad(Math.floor((total % 3600) / 60))}`;
    }
    return `${Math.floor(total / 60)}:${pad(total % 60)}`;
  }
}
