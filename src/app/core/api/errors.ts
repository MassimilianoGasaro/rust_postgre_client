import { HttpErrorResponse } from '@angular/common/http';

/** Chiave Transloco per un errore HTTP: `errors.<code>` dal corpo del backend, altrimenti `errors.GENERIC`. */
export function errorKey(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const body: unknown = err.error;
    if (body !== null && typeof body === 'object' && 'code' in body) {
      const code = (body as { code: unknown }).code;
      if (typeof code === 'string' && code.length > 0) {
        return `errors.${code}`;
      }
    }
  }
  return 'errors.GENERIC';
}
