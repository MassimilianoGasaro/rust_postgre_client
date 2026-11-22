import { HttpParams } from '@angular/common/http';

/** Costruisce i parametri di query scartando i valori `undefined`/`null`. */
export function toParams(values: Record<string, string | number | undefined | null>): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null) {
      params = params.set(key, String(value));
    }
  }
  return params;
}
