// Modelli dell'API: rispecchiano i DTO del backend (campi snake_case come serializzati).

export type Role = 'athlete' | 'coach';

export interface UserInfo {
  id: number;
  email: string;
  username: string;
  role: Role;
}

export interface AuthResponse {
  token: string;
  user: UserInfo;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
  role: Role;
}

export interface Profile {
  language: string;
  timezone: string;
  /** Data ISO `YYYY-MM-DD` */
  birth_date: string | null;
  sex: string | null;
  weight_kg: number | null;
  max_hr: number | null;
  resting_hr: number | null;
  ftp_watts: number | null;
  threshold_pace_s_per_km: number | null;
}

export interface Me {
  id: number;
  email: string;
  username: string;
  role: Role;
  created_at: string;
  profile: Profile;
}

/** Corpo di PATCH /api/users/me: campo assente = invariato, `null` = azzera (solo campi nullable). */
export type UpdateMeRequest = Partial<Profile> & {
  email?: string;
  username?: string;
  password?: string;
  /** Obbligatoria quando cambiano email o password */
  current_password?: string;
};

export interface UserRef {
  id: number;
  username: string;
}

export type CoachLinkStatus = 'pending' | 'active' | 'rejected' | 'cancelled' | 'revoked';

export interface CoachLink {
  id: number;
  athlete: UserRef;
  coach: UserRef;
  status: CoachLinkStatus;
  requested_at: string;
  responded_at: string | null;
  ended_at: string | null;
}

export interface LinkedAthlete {
  id: number;
  username: string;
  linked_since: string;
}

export type ImportItemStatus = 'pending' | 'imported' | 'duplicate' | 'failed';

export interface ImportItem {
  filename: string;
  status: ImportItemStatus;
  /** Attività creata (imported) o già esistente (duplicate) */
  activity_id: number | null;
  /** Motivo del fallimento (failed), es. PARSE_ERROR */
  error_code: string | null;
}

export type ImportStatus = 'processing' | 'completed' | 'failed';

export interface ImportDto {
  id: number;
  status: ImportStatus;
  created_at: string;
  finished_at: string | null;
  /** Assente nell'elenco (GET /api/imports) */
  items?: ImportItem[];
}

export interface Activity {
  id: number;
  source: string;
  sport: string;
  sport_raw: string;
  name: string | null;
  /** Inizio in UTC (RFC 3339) */
  start_time: string;
  utc_offset_seconds: number | null;
  elapsed_s: number;
  moving_s: number | null;
  distance_m: number | null;
  elevation_gain_m: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  avg_speed_mps: number | null;
  avg_power_w: number | null;
  avg_cadence: number | null;
  calories: number | null;
  file_format: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
}

export type Granularity = 'day' | 'week' | 'month';

export interface StatsTotals {
  count: number;
  distance_m: number;
  moving_s: number;
  elapsed_s: number;
  elevation_gain_m: number;
}

export interface SportStats {
  sport: string;
  count: number;
  distance_m: number;
  moving_s: number;
}

export interface PeriodStats {
  /** Primo giorno del periodo (`YYYY-MM-DD`) */
  period_start: string;
  count: number;
  distance_m: number;
  moving_s: number;
  elevation_gain_m: number;
}

export interface StatsSummary {
  from: string;
  to: string;
  granularity: Granularity;
  /** Fuso dell'atleta in cui sono calcolati giorni e periodi */
  timezone: string;
  totals: StatsTotals;
  by_sport: SportStats[];
  series: PeriodStats[];
}

/** Intervallo di date ISO `YYYY-MM-DD` (inclusivo). */
export interface DateRange {
  from: string;
  to: string;
}
