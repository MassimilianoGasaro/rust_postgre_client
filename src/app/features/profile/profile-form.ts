import { Me, UpdateMeRequest } from '../../core/api/models';
import { parseIsoDate, toIsoDate } from '../../core/time/dates';

/** Valori del form profilo (campi di testo come stringhe, numeri come `number | null`). */
export interface ProfileFormValue {
  email: string;
  username: string;
  password: string;
  currentPassword: string;
  language: string;
  timezone: string;
  birthDate: Date | null;
  sex: string;
  weightKg: number | null;
  maxHr: number | null;
  restingHr: number | null;
  ftpWatts: number | null;
  thresholdPace: string;
}

const PACE_RE = /^(\d{1,2}):([0-5]\d)$/;

/** Passo `m:ss` per km -> secondi; `null` se il formato non è valido o il passo è zero. */
export function paceToSeconds(text: string): number | null {
  const match = PACE_RE.exec(text.trim());
  if (!match) return null;
  const seconds = Number(match[1]) * 60 + Number(match[2]);
  return seconds > 0 ? seconds : null;
}

/** Secondi per km -> `m:ss`; stringa vuota se assente. */
export function secondsToPace(seconds: number | null): string {
  if (seconds === null) return '';
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** Elenco di riserva se `Intl.supportedValuesOf` non è disponibile. */
const FALLBACK_TIMEZONES = [
  'Africa/Cairo',
  'Africa/Johannesburg',
  'America/Argentina/Buenos_Aires',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Mexico_City',
  'America/New_York',
  'America/Sao_Paulo',
  'America/Toronto',
  'Asia/Dubai',
  'Asia/Hong_Kong',
  'Asia/Kolkata',
  'Asia/Seoul',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Atlantic/Reykjavik',
  'Australia/Melbourne',
  'Australia/Sydney',
  'Europe/Amsterdam',
  'Europe/Athens',
  'Europe/Berlin',
  'Europe/Lisbon',
  'Europe/London',
  'Europe/Madrid',
  'Europe/Paris',
  'Europe/Rome',
  'Europe/Zurich',
  'Pacific/Auckland',
  'Pacific/Honolulu',
  'UTC',
];

/** Sottoinsieme di `Intl` usato per i fusi orari (iniettabile nei test). */
export interface TimezoneSource {
  supportedValuesOf?: (key: 'timeZone') => string[];
}

/** Fusi orari proponibili: quelli del browser (o l'elenco di riserva), sempre con `UTC` e con `extra`. */
export function timezoneOptions(source: TimezoneSource = Intl, extra?: string): string[] {
  let zones: string[] = [];
  try {
    zones = source.supportedValuesOf?.('timeZone') ?? [];
  } catch {
    zones = [];
  }
  const list = new Set(zones.length > 0 ? zones : FALLBACK_TIMEZONES);
  list.add('UTC');
  if (extra) list.add(extra);
  return [...list].sort();
}

/** Valori iniziali del form a partire dal profilo caricato. */
export function formValueFrom(me: Me): ProfileFormValue {
  const p = me.profile;
  return {
    email: me.email,
    username: me.username,
    password: '',
    currentPassword: '',
    language: p.language,
    timezone: p.timezone,
    birthDate: parseIsoDate(p.birth_date),
    sex: p.sex ?? '',
    weightKg: p.weight_kg,
    maxHr: p.max_hr,
    restingHr: p.resting_hr,
    ftpWatts: p.ftp_watts,
    thresholdPace: secondsToPace(p.threshold_pace_s_per_km),
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Corpo del PATCH: solo i campi cambiati rispetto al profilo caricato; un campo opzionale
 * svuotato diventa `null`. I dati fisiologici entrano solo per gli atleti.
 */
export function buildPatch(me: Me, v: ProfileFormValue, isAthlete: boolean): UpdateMeRequest {
  const patch: UpdateMeRequest = {};

  const email = v.email.trim();
  if (email !== me.email) patch.email = email;
  const username = v.username.trim();
  if (username !== me.username) patch.username = username;
  if (v.password !== '') patch.password = v.password;
  if (patch.email !== undefined || patch.password !== undefined) {
    patch.current_password = v.currentPassword;
  }

  const p = me.profile;
  if (v.language !== p.language) patch.language = v.language;
  if (v.timezone !== p.timezone) patch.timezone = v.timezone;

  if (isAthlete) {
    const birth = v.birthDate === null ? null : toIsoDate(v.birthDate);
    if (birth !== p.birth_date) patch.birth_date = birth;
    const sex = v.sex === '' ? null : v.sex;
    if (sex !== p.sex) patch.sex = sex;
    const weight = v.weightKg === null ? null : round1(v.weightKg);
    if (weight !== p.weight_kg) patch.weight_kg = weight;
    if (v.maxHr !== p.max_hr) patch.max_hr = v.maxHr;
    if (v.restingHr !== p.resting_hr) patch.resting_hr = v.restingHr;
    if (v.ftpWatts !== p.ftp_watts) patch.ftp_watts = v.ftpWatts;
    const pace = v.thresholdPace.trim() === '' ? null : paceToSeconds(v.thresholdPace);
    if (pace !== p.threshold_pace_s_per_km) patch.threshold_pace_s_per_km = pace;
  }
  return patch;
}
