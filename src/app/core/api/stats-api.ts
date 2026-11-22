import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DateRange, Granularity, StatsSummary } from './models';
import { toParams } from './http-params';

export interface StatsOptions {
  sport?: string;
  granularity?: Granularity;
  athlete_id?: number;
}

@Injectable({ providedIn: 'root' })
export class StatsApi {
  private readonly http = inject(HttpClient);

  summary(range: DateRange, opts: StatsOptions = {}): Observable<StatsSummary> {
    return this.http.get<StatsSummary>('/api/stats/summary', {
      params: toParams({ from: range.from, to: range.to, ...opts }),
    });
  }
}
