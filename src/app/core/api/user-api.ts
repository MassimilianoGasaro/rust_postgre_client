import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Me, UpdateMeRequest } from './models';

@Injectable({ providedIn: 'root' })
export class UserApi {
  private readonly http = inject(HttpClient);

  me(): Observable<Me> {
    return this.http.get<Me>('/api/users/me');
  }

  update(patch: UpdateMeRequest): Observable<Me> {
    return this.http.patch<Me>('/api/users/me', patch);
  }

  /** Elimina l'account: il backend richiede la password attuale nel corpo JSON. */
  deleteMe(currentPassword: string): Observable<void> {
    return this.http.delete<void>('/api/users/me', { body: { current_password: currentPassword } });
  }
}
