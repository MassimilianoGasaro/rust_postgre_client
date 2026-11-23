/** Data ISO -> data in formato "medium" nella lingua indicata (es. "1 nov 2026"). */
import { dateLocale } from './date-locale';

export function mediumDate(iso: string, lang: string): string {
  return new Intl.DateTimeFormat(dateLocale(lang), { dateStyle: 'medium' }).format(new Date(iso));
}
