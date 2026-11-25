import { Activity, DateRange } from '../../../core/api/models';
import { parseIsoDate, toIsoDate } from '../../../core/time/dates';

/** Sport per cui ha senso incrociare FC e velocità. */
export const FITNESS_SPORTS = ['running', 'walking', 'hiking', 'cycling'] as const;
export type FitnessSport = (typeof FITNESS_SPORTS)[number];

/** Corsa/camminata/escursione: passo (s/km, più basso = meglio); bici: velocità (km/h). */
export type SpeedMetric = 'pace' | 'speed';

/** Attività più brevi non sono rappresentative della forma aerobica. */
export const MIN_DURATION_S = 15 * 60;

export interface HrBand {
  min: number;
  max: number;
}

/** Fascia usata quando il profilo non ha FC massima (o non è leggibile, es. vista coach). */
export const DEFAULT_BAND: HrBand = { min: 135, max: 150 };

export type FitnessGranularity = 'week' | 'month';

const DAY_MS = 86_400_000;

/** Un'attività valida per l'analisi, con valori già normalizzati. */
export interface FitnessPoint {
  id: number;
  /** Ora locale dell'attività espressa come istante UTC (giorno e ora "da muro"). */
  t: number;
  hr: number;
  speedMps: number;
  movingS: number;
  distanceM: number;
}

export function isFitnessSport(sport: string): sport is FitnessSport {
  return (FITNESS_SPORTS as readonly string[]).includes(sport);
}

/** Sport analizzato: quello filtrato se adatto, corsa se "tutti", altrimenti nessuno. */
export function fitnessSportFor(filter: string): FitnessSport | null {
  if (filter === 'all') return 'running';
  return isFitnessSport(filter) ? filter : null;
}

export function metricFor(sport: FitnessSport): SpeedMetric {
  return sport === 'cycling' ? 'speed' : 'pace';
}

/** Attività dello sport con FC, velocità e durata sufficienti, in ordine cronologico. */
export function toPoints(activities: readonly Activity[], sport: FitnessSport): FitnessPoint[] {
  const points: FitnessPoint[] = [];
  for (const a of activities) {
    if (a.sport !== sport) continue;
    const movingS = a.moving_s ?? a.elapsed_s;
    const distanceM = a.distance_m ?? 0;
    const speedMps = a.avg_speed_mps ?? (movingS > 0 ? distanceM / movingS : 0);
    const start = Date.parse(a.start_time);
    if (
      a.avg_hr === null ||
      !(a.avg_hr > 0) ||
      !(movingS >= MIN_DURATION_S) ||
      !(speedMps > 0) ||
      Number.isNaN(start)
    ) {
      continue;
    }
    points.push({
      id: a.id,
      t: start + (a.utc_offset_seconds ?? 0) * 1000,
      hr: a.avg_hr,
      speedMps,
      movingS,
      distanceM: distanceM > 0 ? distanceM : speedMps * movingS,
    });
  }
  return points.sort((x, y) => x.t - y.t);
}

/** Indice di efficienza: metri al minuto per battito. Più alto = più veloce a parità di FC. */
export function efficiency(p: Pick<FitnessPoint, 'speedMps' | 'hr'>): number {
  return (p.speedMps * 60) / p.hr;
}

export function paceSecPerKm(speedMps: number): number {
  return 1000 / speedMps;
}

export function speedKmh(speedMps: number): number {
  return speedMps * 3.6;
}

/** Valore del passo o della velocità nell'unità mostrata. */
export function metricValue(speedMps: number, metric: SpeedMetric): number {
  return metric === 'pace' ? paceSecPerKm(speedMps) : speedKmh(speedMps);
}

/** Media mobile su finestra temporale (in giorni) che termina su ciascun punto. */
export function rollingMean(
  points: readonly FitnessPoint[],
  value: (p: FitnessPoint) => number,
  windowDays = 28,
): number[] {
  const windowMs = windowDays * DAY_MS;
  return points.map((p) => {
    let sum = 0;
    let n = 0;
    for (const q of points) {
      if (q.t <= p.t && q.t > p.t - windowMs) {
        sum += value(q);
        n++;
      }
    }
    return sum / n;
  });
}

/** Retta dei minimi quadrati; `null` se i punti sono meno di 2 o tutti con la stessa x. */
export function linearFit(
  xs: readonly number[],
  ys: readonly number[],
): { slope: number; intercept: number } | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return null;
  let mx = 0;
  let my = 0;
  for (let i = 0; i < n; i++) {
    mx += xs[i];
    my += ys[i];
  }
  mx /= n;
  my /= n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  if (den === 0) return null;
  const slope = num / den;
  return { slope, intercept: my - slope * mx };
}

/**
 * Zona 2 dal profilo: Karvonen 60–70% della riserva cardiaca se c'è la FC a riposo,
 * altrimenti 65–75% della FC massima. `null` senza FC massima valida.
 */
export function hrBandFromProfile(
  maxHr: number | null | undefined,
  restingHr: number | null | undefined,
): HrBand | null {
  if (maxHr === null || maxHr === undefined || !(maxHr > 0)) return null;
  if (restingHr !== null && restingHr !== undefined && restingHr > 0 && restingHr < maxHr) {
    const reserve = maxHr - restingHr;
    return {
      min: Math.round(restingHr + 0.6 * reserve),
      max: Math.round(restingHr + 0.7 * reserve),
    };
  }
  return { min: Math.round(maxHr * 0.65), max: Math.round(maxHr * 0.75) };
}

export function inBand(p: Pick<FitnessPoint, 'hr'>, band: HrBand): boolean {
  return p.hr >= band.min && p.hr <= band.max;
}

/** Settimane fino a ~4 mesi, poi mesi. */
export function granularityFor(range: DateRange): FitnessGranularity {
  const from = parseIsoDate(range.from);
  const to = parseIsoDate(range.to);
  if (from === null || to === null) return 'week';
  const days = Math.round((to.getTime() - from.getTime()) / DAY_MS) + 1;
  return days <= 120 ? 'week' : 'month';
}

/** Inizio del periodo (lunedì o primo del mese) di un istante "da muro", come `YYYY-MM-DD`. */
export function bucketStart(t: number, granularity: FitnessGranularity): string {
  const d = new Date(t);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  if (granularity === 'month') return toIsoDate(new Date(y, m, 1));
  const monday = d.getUTCDate() - ((d.getUTCDay() + 6) % 7);
  return toIsoDate(new Date(y, m, monday));
}

/** Tutti i periodi dell'intervallo, anche quelli senza attività. */
export function bucketsInRange(range: DateRange, granularity: FitnessGranularity): string[] {
  const from = parseIsoDate(range.from);
  const to = parseIsoDate(range.to);
  if (from === null || to === null || from > to) return [];
  const keys: string[] = [];
  const toUtc = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  let cursor = parseIsoDate(bucketStart(toUtc(from), granularity))!;
  while (cursor <= to) {
    keys.push(toIsoDate(cursor));
    cursor =
      granularity === 'week'
        ? new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 7)
        : new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return keys;
}

export interface Bucket {
  start: string;
  points: FitnessPoint[];
}

export function bucketize(
  points: readonly FitnessPoint[],
  range: DateRange,
  granularity: FitnessGranularity,
): Bucket[] {
  const buckets = bucketsInRange(range, granularity).map((start) => ({
    start,
    points: [] as FitnessPoint[],
  }));
  const index = new Map(buckets.map((b) => [b.start, b]));
  for (const p of points) index.get(bucketStart(p.t, granularity))?.points.push(p);
  return buckets;
}

/** Velocità media pesata sulla durata (distanza totale / tempo totale); `null` se vuoto. */
export function meanSpeed(points: readonly FitnessPoint[]): number | null {
  let distance = 0;
  let time = 0;
  for (const p of points) {
    distance += p.distanceM;
    time += p.movingS;
  }
  return time > 0 && distance > 0 ? distance / time : null;
}

/** Durata dell'attività più lunga; `null` se vuoto. */
export function longest(points: readonly FitnessPoint[]): number | null {
  return points.length === 0 ? null : Math.max(...points.map((p) => p.movingS));
}

/** Divide i punti in `parts` gruppi di pari durata sull'intervallo (dal più vecchio). */
export function splitByTime(
  points: readonly FitnessPoint[],
  range: DateRange,
  parts: number,
): FitnessPoint[][] {
  const groups: FitnessPoint[][] = Array.from({ length: parts }, () => []);
  const from = parseIsoDate(range.from);
  const to = parseIsoDate(range.to);
  if (from === null || to === null) return groups;
  const start = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const end = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate()) + DAY_MS;
  const span = Math.max(end - start, 1);
  for (const p of points) {
    const i = Math.floor(((p.t - start) / span) * parts);
    groups[Math.min(Math.max(i, 0), parts - 1)].push(p);
  }
  return groups;
}

export interface Kpi {
  value: number;
  /** Seconda metà del periodo meno prima metà; `null` se una delle due è vuota. */
  delta: number | null;
}

function kpi(
  points: readonly FitnessPoint[],
  range: DateRange,
  summarize: (ps: readonly FitnessPoint[]) => number | null,
): Kpi | null {
  const value = summarize(points);
  if (value === null) return null;
  const [first, second] = splitByTime(points, range, 2);
  const a = summarize(first);
  const b = summarize(second);
  return { value, delta: a === null || b === null ? null : b - a };
}

const mean = (xs: readonly number[]) =>
  xs.length === 0 ? null : xs.reduce((s, x) => s + x, 0) / xs.length;

export interface FitnessKpis {
  /** Passo (s/km) o velocità (km/h) medi nella fascia di FC. */
  bandMetric: Kpi | null;
  efficiency: Kpi | null;
  /** Durata (s) dell'attività più lunga nella fascia. */
  longestInBand: Kpi | null;
}

export function fitnessKpis(
  points: readonly FitnessPoint[],
  range: DateRange,
  band: HrBand,
  metric: SpeedMetric,
): FitnessKpis {
  const banded = points.filter((p) => inBand(p, band));
  const bandMetric = (ps: readonly FitnessPoint[]) => {
    const s = meanSpeed(ps);
    return s === null ? null : metricValue(s, metric);
  };
  return {
    bandMetric: kpi(banded, range, bandMetric),
    efficiency: kpi(points, range, (ps) => mean(ps.map(efficiency))),
    longestInBand: kpi(banded, range, longest),
  };
}
