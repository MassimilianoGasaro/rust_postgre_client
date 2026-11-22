import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

/** Codice errore del backend dal corpo della risposta, se presente. */
function errorCode(err: HttpErrorResponse): string | null {
  const body: unknown = err.error;
  if (body !== null && typeof body === 'object' && 'code' in body) {
    const code = (body as { code: unknown }).code;
    return typeof code === 'string' ? code : null;
  }
  return null;
}

/**
 * Aggiunge il Bearer alle richieste `/api/`; un 401 su una richiesta autenticata fuori da
 * `/api/auth/` (e diverso da INVALID_CREDENTIALS) chiude la sessione.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/api/')) {
    return next(req);
  }

  const auth = inject(AuthService);
  const token = auth.token();
  const outgoing = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(outgoing).pipe(
    catchError((err: unknown) => {
      // Sessione scaduta solo se la richiesta portava un token e il 401 non è una
      // password attuale errata (PATCH/DELETE /api/users/me -> INVALID_CREDENTIALS).
      if (
        token &&
        err instanceof HttpErrorResponse &&
        err.status === 401 &&
        !req.url.startsWith('/api/auth/') &&
        errorCode(err) !== 'INVALID_CREDENTIALS'
      ) {
        auth.logout('expired');
      }
      return throwError(() => err);
    }),
  );
};
