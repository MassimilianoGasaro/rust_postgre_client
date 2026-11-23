import { dateLocale } from '../../core/format/date-locale';

const MISSING = '—';

/**
 * Data/ora di inizio nell'ora locale dell'attività se l'offset è noto,
 * altrimenti nel fuso del browser.
 */
export function formatActivityStart(
  startIso: string,
  offsetSeconds: number | null,
  lang: string,
): string {
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return MISSING;
  const options: Intl.DateTimeFormatOptions = { dateStyle: 'short', timeStyle: 'short' };
  if (offsetSeconds === null) {
    return new Intl.DateTimeFormat(dateLocale(lang), options).format(start);
  }
  // si sposta l'istante dell'offset e si formatta in UTC: l'ora mostrata è quella locale dell'attività
  const shifted = new Date(start.getTime() + offsetSeconds * 1000);
  return new Intl.DateTimeFormat(dateLocale(lang), { ...options, timeZone: 'UTC' }).format(shifted);
}

/** Metri di dislivello -> "123 m". */
export function formatElevation(meters: number | null | undefined): string {
  if (meters === null || meters === undefined || !Number.isFinite(meters)) return MISSING;
  return `${Math.round(meters)} m`;
}

/** Battiti al minuto, arrotondati. */
export function formatHeartRate(bpm: number | null | undefined): string {
  if (bpm === null || bpm === undefined || !Number.isFinite(bpm)) return MISSING;
  return String(Math.round(bpm));
}
