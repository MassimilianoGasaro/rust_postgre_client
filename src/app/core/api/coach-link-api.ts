import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CoachLink, CoachLinkStatus, LinkedAthlete } from './models';
import { toParams } from './http-params';

@Injectable({ providedIn: 'root' })
export class CoachLinkApi {
  private readonly http = inject(HttpClient);

  /** L'atleta richiede il collegamento a un coach (email o username). */
  request(coach: string): Observable<CoachLink> {
    return this.http.post<CoachLink>('/api/coach-links', { coach });
  }

  list(status?: CoachLinkStatus): Observable<CoachLink[]> {
    return this.http.get<CoachLink[]>('/api/coach-links', { params: toParams({ status }) });
  }

  accept(id: number): Observable<CoachLink> {
    return this.transition(id, 'accept');
  }

  reject(id: number): Observable<CoachLink> {
    return this.transition(id, 'reject');
  }

  cancel(id: number): Observable<CoachLink> {
    return this.transition(id, 'cancel');
  }

  revoke(id: number): Observable<CoachLink> {
    return this.transition(id, 'revoke');
  }

  athletes(): Observable<LinkedAthlete[]> {
    return this.http.get<LinkedAthlete[]>('/api/athletes');
  }

  private transition(
    id: number,
    action: 'accept' | 'reject' | 'cancel' | 'revoke',
  ): Observable<CoachLink> {
    return this.http.post<CoachLink>(`/api/coach-links/${id}/${action}`, {});
  }
}
