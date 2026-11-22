import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Activity, DateRange, Page } from './models';
import { toParams } from './http-params';

export type ActivityQuery = Partial<DateRange> & {
  sport?: string;
  page?: number;
  per_page?: number;
  athlete_id?: number;
};

@Injectable({ providedIn: 'root' })
export class ActivityApi {
  private readonly http = inject(HttpClient);

  list(query: ActivityQuery = {}): Observable<Page<Activity>> {
    return this.http.get<Page<Activity>>('/api/activities', { params: toParams(query) });
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`/api/activities/${id}`);
  }
}
