import { Injectable } from '@angular/core';
import { NativeDateAdapter } from '@angular/material/core';

/** Locale che scrivono le date giorno-mese-anno (vedi `dateLocale`). */
const DAY_FIRST = /^(it|en-gb)/i;

/**
 * Adapter nativo che, con locale italiano o inglese (`en-GB`), interpreta le date digitate come gg/mm/aaaa
 * (il parsing nativo del browser assume mm/gg/aaaa). Un numerico con separatori che non sia gg/mm/aaaa
 * (anno a 2 cifre, ecc.) e' invalido: non cade mai nel parsing nativo.
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
      // numerico con separatori ma non gg/mm/aaaa (es. anno a 2 cifre): niente Date.parse, che lo leggerebbe mm/gg
      if (/^[\d\s/.-]*\d\s*[/.-]\s*\d[\d\s/.-]*$/.test(value)) {
        return this.invalid();
      }
    }
    return super.parse(value, parseFormat);
  }
}
