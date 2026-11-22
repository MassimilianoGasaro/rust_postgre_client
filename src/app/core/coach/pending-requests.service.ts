import { inject, Injectable, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { CoachLinkApi } from '../api/coach-link-api';

/** Numero di richieste di collegamento in attesa (badge del menu coach); nessun polling. */
@Injectable({ providedIn: 'root' })
export class PendingRequestsService {
  private readonly api = inject(CoachLinkApi);
  private readonly _count = signal(0);
  private inFlight: Subscription | null = null;

  readonly count = this._count.asReadonly();

  /** Ricarica il conteggio dal backend; una richiesta più recente sostituisce quella in corso. */
  refresh(): void {
    this.inFlight?.unsubscribe();
    this.inFlight = this.api.list('pending').subscribe({
      next: (links) => this._count.set(links.length),
      // in caso di errore resta l'ultimo valore noto: il badge non è critico
      error: () => undefined,
    });
  }

  /** Imposta il conteggio quando la pagina delle richieste ha già l'elenco aggiornato. */
  set(count: number): void {
    // un conteggio più recente di quello in volo: la risposta in ritardo non deve sovrascriverlo
    this.inFlight?.unsubscribe();
    this._count.set(count);
  }

  /** Azzera il conteggio (nessun coach connesso) e scarta l'eventuale richiesta in corso. */
  clear(): void {
    this.inFlight?.unsubscribe();
    this.inFlight = null;
    this._count.set(0);
  }
}
