import { Injectable } from '@angular/core';
import { NativeDateAdapter } from '@angular/material/core';

/** Locale che scrivono le date giorno-mese-anno (vedi `dateLocale`). */
const DAY_FIRST = /^(it|en-gb)/i;

/**
 * Adapter nativo che, con locale italiano o inglese (`en-GB`), interpreta le date digitate come gg/mm/aaaa
 * (il parsing nativo del browser assume mm/gg/aaaa).
 */
@Injectable()
export class LocalDateAdapter extends NativeDateAdapter {
  override parse(value: unknown, parseFormat?: unknown): Date | null {
    if (typeof value === 'string' && DAY_FIRST.test(this.locale.toString())) {
      const match = /^\s*(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\s*$/.exec(value);
      if (match) {
        const [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
        const date = new Date(year, month - 1, day);
        const valid =
          date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
        return valid ? date : this.invalid();
      }
    }
    return super.parse(value, parseFormat);
  }
}
