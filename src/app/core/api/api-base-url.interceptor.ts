import { InjectionToken, inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';

/** Origine del backend da anteporre alle richieste `/api/`; vuota = stessa origine del client. */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => environment.apiBaseUrl,
});

/**
 * Antepone `API_BASE_URL` alle richieste `/api/`. Va registrato dopo authInterceptor, che
 * riconosce le richieste al backend dal percorso relativo.
 */
export const apiBaseUrlInterceptor: HttpInterceptorFn = (req, next) => {
  const base = inject(API_BASE_URL);
  if (!base || !req.url.startsWith('/api/')) {
    return next(req);
  }
  return next(req.clone({ url: base.replace(/\/+$/, '') + req.url }));
};
