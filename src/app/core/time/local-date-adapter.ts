import { Injectable } from '@angular/core';
import { NativeDateAdapter } from '@angular/material/core';

/**
 * Adapter nativo che, con locale italiano, interpreta le date digitate come gg/mm/aaaa
 * (il parsing nativo del browser assume mm/gg/aaaa).
 */
@Injectable()
export class LocalDateAdapter extends NativeDateAdapter {
  override parse(value: unknown, parseFormat?: unknown): Date | null {
    if (typeof value === 'string' && this.locale.toString().toLowerCase().startsWith('it')) {
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
