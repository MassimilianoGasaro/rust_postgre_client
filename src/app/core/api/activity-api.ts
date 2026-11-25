import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map, of, switchMap } from 'rxjs';
import { Activity, DateRange, Page } from './models';
import { toParams } from './http-params';

export type ActivityQuery = Partial<DateRange> & {
  sport?: string;
  page?: number;
  per_page?: number;
  athlete_id?: number;
};

/** Massimo `per_page` accettato dal backend. */
const MAX_PER_PAGE = 100;

@Injectable({ providedIn: 'root' })
export class ActivityApi {
  private readonly http = inject(HttpClient);

  list(query: ActivityQuery = {}): Observable<Page<Activity>> {
    return this.http.get<Page<Activity>>('/api/activities', { params: toParams(query) });
  }

  /**
   * Tutte le attività che rispettano i filtri, scaricate a pagine da 100
   * (al massimo `maxPages` pagine, per non sovraccaricare periodi molto lunghi).
   */
  listAll(
    query: Omit<ActivityQuery, 'page' | 'per_page'> = {},
    maxPages = 10,
  ): Observable<Activity[]> {
    const page = (n: number) => this.list({ ...query, page: n, per_page: MAX_PER_PAGE });
    return page(1).pipe(
      switchMap((first) => {
        const pages = Math.min(Math.ceil(first.total / MAX_PER_PAGE), maxPages);
        if (pages <= 1) return of(first.items);
        const rest = Array.from({ length: pages - 1 }, (_, i) => page(i + 2));
        return forkJoin(rest).pipe(
          map((more) => [first.items, ...more.map((p) => p.items)].flat()),
        );
      }),
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`/api/activities/${id}`);
  }
}
