import { InjectionToken } from '@angular/core';

/** Fornisce "adesso" (data locale del browser); i test lo sostituiscono per fissare la data. */
export const TODAY = new InjectionToken<() => Date>('TODAY', {
  providedIn: 'root',
  factory: () => () => new Date(),
});
