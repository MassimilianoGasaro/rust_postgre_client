import { computed, inject, Injectable, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { CoachLinkApi } from '../api/coach-link-api';
import { AuthService } from '../auth/auth.service';

/**
 * Numero di richieste di collegamento in attesa (badge del menu coach); nessun polling.
 * Il conteggio appartiene all'utente che lo ha caricato: visibile solo a quel coach, quindi non
 * può passare a un'altra sessione né restare visibile dopo logout o per un atleta.
 */
@Injectable({ providedIn: 'root' })
export class PendingRequestsService {
  private readonly api = inject(CoachLinkApi);
  private readonly auth = inject(AuthService);

  private readonly stored = signal<{ userId: number; count: number } | null>(null);
  private inFlight: Subscription | null = null;

  readonly count = computed(() => {
    const user = this.auth.user();
    const stored = this.stored();
    return user?.role === 'coach' && stored?.userId === user.id ? stored.count : 0;
  });

  /** Ricarica il conteggio dal backend; una richiesta più recente sostituisce quella in corso. */
  refresh(): void {
    this.inFlight?.unsubscribe();
    this.inFlight = null;
    const userId = this.auth.user()?.id;
    if (userId === undefined) return;
    // altro utente: si riparte da 0, un errore non deve far ricomparire il valore precedente
    if (this.stored()?.userId !== userId) this.stored.set({ userId, count: 0 });
    this.inFlight = this.api.list('pending').subscribe({
      // la risposta vale solo se la sessione è ancora quella che l'ha richiesta
      next: (links) => {
        if (this.auth.user()?.id === userId) this.stored.set({ userId, count: links.length });
      },
      // in caso di errore resta l'ultimo valore noto dello stesso utente: il badge non è critico
      error: () => undefined,
    });
  }

  /** Imposta il conteggio quando la pagina delle richieste ha già l'elenco aggiornato. */
  set(count: number): void {
    // un conteggio più recente di quello in volo: la risposta in ritardo non deve sovrascriverlo
    this.inFlight?.unsubscribe();
    this.inFlight = null;
    const userId = this.auth.user()?.id;
    if (userId !== undefined) this.stored.set({ userId, count });
  }

  /** Azzera il conteggio e scarta l'eventuale richiesta in corso. */
  clear(): void {
    this.inFlight?.unsubscribe();
    this.inFlight = null;
    this.stored.set(null);
  }
}
