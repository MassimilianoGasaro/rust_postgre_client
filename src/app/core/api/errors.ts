import { HttpErrorResponse } from '@angular/common/http';

/**
 * Codici d'errore del backend con una traduzione `errors.<CODE>`
 * (deve coincidere con le chiavi `errors.*` di public/i18n, GENERIC escluso: lo verifica errors.spec.ts).
 */
export const KNOWN_ERROR_CODES: ReadonlySet<string> = new Set([
  'ACCOUNT_DISABLED',
  'ARCHIVE_TOO_LARGE',
  'ATHLETE_ACCESS_DENIED',
  'BAD_REQUEST',
  'COACH_LINK_EXISTS',
  'COACH_NOT_FOUND',
  'CONFLICT',
  'DUPLICATE_FILE',
  'EMAIL_TAKEN',
  'EMPTY_ACTIVITY',
  'FILE_TOO_LARGE',
  'FORBIDDEN',
  'IMPORT_INTERRUPTED',
  'IMPORT_IN_PROGRESS',
  'INTERNAL',
  'INVALID_CREDENTIALS',
  'INVALID_TIMEZONE',
  'LINK_INVALID_STATE',
  'METHOD_NOT_ALLOWED',
  'NOT_A_COACH',
  'NOT_FOUND',
  'NO_FILES',
  'PARSE_ERROR',
  'ROLE_FORBIDDEN',
  'UNAUTHORIZED',
  'UNSUPPORTED_FORMAT',
  'UPLOAD_TOO_LARGE',
  'USERNAME_TAKEN',
  'VALIDATION_FAILED',
]);

/** Chiave Transloco per un codice d'errore: `errors.<code>` se noto, altrimenti `errors.GENERIC`. */
export function errorCodeKey(code: string | null | undefined): string {
  return code != null && KNOWN_ERROR_CODES.has(code) ? `errors.${code}` : 'errors.GENERIC';
}

/** Chiave Transloco per un errore HTTP: `errors.<code>` dal corpo del backend, altrimenti `errors.GENERIC`. */
export function errorKey(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const body: unknown = err.error;
    if (body !== null && typeof body === 'object' && 'code' in body) {
      const code = (body as { code: unknown }).code;
      if (typeof code === 'string') {
        return errorCodeKey(code);
      }
    }
  }
  return 'errors.GENERIC';
}
