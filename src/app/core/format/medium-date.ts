/** Data ISO -> data in formato "medium" nella lingua indicata (es. "1 nov 2026"). */
export function mediumDate(iso: string, lang: string): string {
  return new Intl.DateTimeFormat(lang, { dateStyle: 'medium' }).format(new Date(iso));
}
