import { DateRange } from '../api/models';

export type Preset = '7d' | '30d' | '90d' | '1y';

export const PRESETS: readonly Preset[] = ['7d', '30d', '90d', '1y'];
export const DEFAULT_PRESET: Preset = '30d';

const PRESET_DAYS: Record<Preset, number> = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };

const pad = (n: number) => String(n).padStart(2, '0');

/** Data locale (nessuno shift UTC) -> `YYYY-MM-DD`. */
export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** `YYYY-MM-DD` -> mezzanotte locale; `null` se il formato o la data non sono validi. */
export function parseIsoDate(iso: string | null | undefined): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  const valid =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return valid ? date : null;
}

/** Ultimi N giorni, oggi incluso, nel fuso del browser. */
export function presetRange(preset: Preset, today: Date): DateRange {
  const from = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - (PRESET_DAYS[preset] - 1),
  );
  return { from: toIsoDate(from), to: toIsoDate(today) };
}

export function sameRange(a: DateRange, b: DateRange): boolean {
  return a.from === b.from && a.to === b.to;
}

/** Anni accettati dal backend per from/to (1900..=2200). */
export const MIN_DATE = new Date(1900, 0, 1);
export const MAX_DATE = new Date(2200, 11, 31);

export function inBounds(date: Date): boolean {
  return date >= MIN_DATE && date <= MAX_DATE;
}
