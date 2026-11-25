import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { BreakpointObserver } from '@angular/cdk/layout';
import { TranslocoService } from '@jsverse/transloco';
import { provideEchartsCore } from 'ngx-echarts';
import { of } from 'rxjs';
import { Activity, Page, StatsSummary } from '../../core/api/models';
import { TODAY } from '../../core/time/today';
import { translocoTesting } from '../../testing';
import { DashboardComponent } from './dashboard.component';
import { stubFitnessSection } from './fitness/fitness-section.testing';

import itJson from '../../../../public/i18n/it.json';

const activity = (id: number, over: Partial<Activity> = {}): Activity => ({
  id,
  source: 'upload',
  sport: 'running',
  sport_raw: 'Running',
  name: null,
  start_time: '2026-11-20T08:30:00Z',
  utc_offset_seconds: 3600,
  elapsed_s: 3700,
  moving_s: 3600,
  distance_m: 10000,
  elevation_gain_m: 123.4,
  avg_hr: 151.6,
  max_hr: 180,
  avg_speed_mps: 2.7,
  avg_power_w: null,
  avg_cadence: null,
  calories: null,
  file_format: 'fit',
  ...over,
});

const stats = (over: Partial<StatsSummary> = {}): StatsSummary => ({
  from: '2026-10-24',
  to: '2026-11-22',
  granularity: 'week',
  timezone: 'Europe/Rome',
  totals: { count: 3, distance_m: 30500, moving_s: 10800, elapsed_s: 11000, elevation_gain_m: 410 },
  by_sport: [
    { sport: 'running', count: 2, distance_m: 20500, moving_s: 7200 },
    { sport: 'cycling', count: 1, distance_m: 10000, moving_s: 3600 },
  ],
  series: [
    {
      period_start: '2026-11-09',
      count: 1,
      distance_m: 10000,
      moving_s: 3600,
      elevation_gain_m: 100,
    },
    {
      period_start: '2026-11-16',
      count: 2,
      distance_m: 20500,
      moving_s: 7200,
      elevation_gain_m: 310,
    },
  ],
  ...over,
});

const page = (items: Activity[], over: Partial<Page<Activity>> = {}): Page<Activity> => ({
  items,
  total: items.length,
  page: 1,
  per_page: 10,
  ...over,
});

const emptyStats = () =>
  stats({
    totals: { count: 0, distance_m: 0, moving_s: 0, elapsed_s: 0, elevation_gain_m: 0 },
    by_sport: [],
    series: [],
  });

/** Grafico finto: registra le opzioni passate a setOption. */
const setOption = vi.fn();
const fakeChart = {
  setOption,
  resize: vi.fn(),
  dispose: vi.fn(),
  isDisposed: () => false,
  on: vi.fn(),
  off: vi.fn(),
  showLoading: vi.fn(),
  hideLoading: vi.fn(),
};

/** Opzioni ECharts registrate, per tipo di serie. */
type ChartOption = { xAxis: { data: string[] }; series: { type: string; data: unknown[] }[] };
const chartOptions = () => setOption.mock.calls.map((c) => c[0] as ChartOption);
const byType = (type: string) => chartOptions().filter((o) => o.series[0].type === type);
/** L'inizializzazione di ECharts è asincrona (import lazy): si attende l'ultima opzione del tipo. */
const lastOption = (type: string) =>
  vi.waitFor(() => {
    const found = byType(type).at(-1);
    expect(found).toBeDefined();
    return found!;
  });

interface SetupOptions {
  handset?: boolean;
  /** Query string iniziale dell'URL (senza `?`) */
  query?: string;
  athleteId?: number | null;
  readOnly?: boolean;
}

async function setup(options: SetupOptions = {}) {
  TestBed.configureTestingModule({
    imports: [DashboardComponent, translocoTesting()],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      provideEchartsCore({ echarts: { init: () => fakeChart } }),
      { provide: TODAY, useValue: () => new Date(2026, 10, 22, 15, 30) },
      {
        provide: BreakpointObserver,
        useValue: { observe: () => of({ matches: options.handset ?? false, breakpoints: {} }) },
      },
    ],
  });
  stubFitnessSection();
  const router = TestBed.inject(Router);
  if (options.query) await router.navigateByUrl(`/?${options.query}`);
  const ctrl = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(DashboardComponent);
  if (options.athleteId !== undefined)
    fixture.componentRef.setInput('athleteId', options.athleteId);
  if (options.readOnly) fixture.componentRef.setInput('readOnly', true);
  const denied = vi.fn();
  fixture.componentInstance.accessDenied.subscribe(denied);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const statsReq = () => ctrl.expectOne((r) => r.url === '/api/stats/summary');
  const listReq = () => ctrl.expectOne((r) => r.url === '/api/activities' && r.method === 'GET');
  /** Risponde alle due richieste in corso. */
  const load = async (s: StatsSummary, items: Page<Activity>) => {
    statsReq().flush(s);
    listReq().flush(items);
    await settle();
  };
  return { fixture, el, ctrl, router, denied, settle, statsReq, listReq, load };
}

const q = <T extends HTMLElement>(el: ParentNode, testId: string) =>
  el.querySelector<T>(`[data-testid="${testId}"]`);
const qa = (el: ParentNode, testId: string) =>
  Array.from(el.querySelectorAll<HTMLElement>(`[data-testid="${testId}"]`));

describe('DashboardComponent', () => {
  beforeEach(() => {
    setOption.mockClear();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    document.querySelectorAll('.cdk-overlay-container > *').forEach((n) => n.remove());
  });

  describe('range and requests', () => {
    it('loads stats and activities for the default last 30 days', async () => {
      const { statsReq, listReq } = await setup();
      const s = statsReq();
      expect(s.request.params.get('from')).toBe('2026-10-24');
      expect(s.request.params.get('to')).toBe('2026-11-22');
      expect(s.request.params.has('athlete_id')).toBe(false);
      expect(s.request.params.has('sport')).toBe(false);
      const l = listReq();
      expect(l.request.params.get('from')).toBe('2026-10-24');
      expect(l.request.params.get('to')).toBe('2026-11-22');
      expect(l.request.params.get('page')).toBe('1');
    });

    it('preset 7d sends {from: 2026-11-16, to: 2026-11-22} to both endpoints', async () => {
      const { el, fixture, ctrl, load, statsReq, listReq } = await setup();
      await load(stats(), page([activity(1)]));
      q<HTMLButtonElement>(el, 'preset-7d')!.click();
      fixture.detectChanges();
      await fixture.whenStable();
      const s = statsReq();
      const l = listReq();
      expect(s.request.params.get('from')).toBe('2026-11-16');
      expect(s.request.params.get('to')).toBe('2026-11-22');
      expect(l.request.params.get('from')).toBe('2026-11-16');
      expect(l.request.params.get('to')).toBe('2026-11-22');
      s.flush(stats());
      l.flush(page([]));
      ctrl.verify();
    });

    it('initialises range and sport from the query params', async () => {
      const { statsReq, listReq, el, settle } = await setup({
        query: 'from=2026-01-05&to=2026-03-09&sport=cycling',
      });
      const s = statsReq();
      expect(s.request.params.get('from')).toBe('2026-01-05');
      expect(s.request.params.get('to')).toBe('2026-03-09');
      expect(s.request.params.get('sport')).toBe('cycling');
      expect(listReq().request.params.get('sport')).toBe('cycling');
      await settle();
      expect(q<HTMLSelectElement>(el, 'sport-filter')!.value).toBe('cycling');
    });

    it('ignores query param dates outside 1900..2200', async () => {
      const { statsReq, listReq } = await setup({ query: 'from=1850-01-01&to=2026-02-01' });
      expect(statsReq().request.params.get('from')).toBe('2026-10-24');
      listReq();
    });

    it('ignores malformed query params and falls back to the defaults', async () => {
      const { statsReq, listReq } = await setup({
        query: 'from=oops&to=2026-02-30&sport=quidditch',
      });
      const s = statsReq();
      expect(s.request.params.get('from')).toBe('2026-10-24');
      expect(s.request.params.get('to')).toBe('2026-11-22');
      expect(s.request.params.has('sport')).toBe(false);
      listReq();
    });

    it('writes range and sport back to the query params', async () => {
      const { el, fixture, router, load, statsReq, listReq } = await setup();
      await load(stats(), page([activity(1)]));
      q<HTMLButtonElement>(el, 'preset-7d')!.click();
      fixture.detectChanges();
      await fixture.whenStable();
      statsReq().flush(stats());
      listReq().flush(page([activity(1)]));
      await fixture.whenStable();
      expect(router.url).toContain('from=2026-11-16');
      expect(router.url).toContain('to=2026-11-22');
      const select = q<HTMLSelectElement>(el, 'sport-filter')!;
      select.value = 'swimming';
      select.dispatchEvent(new Event('change'));
      fixture.detectChanges();
      await fixture.whenStable();
      const s = statsReq();
      expect(s.request.params.get('sport')).toBe('swimming');
      s.flush(stats());
      listReq().flush(page([]));
      await fixture.whenStable();
      expect(router.url).toContain('sport=swimming');
    });

    it('athleteId=5 adds athlete_id=5 to both calls', async () => {
      const { statsReq, listReq } = await setup({ athleteId: 5 });
      expect(statsReq().request.params.get('athlete_id')).toBe('5');
      expect(listReq().request.params.get('athlete_id')).toBe('5');
    });

    it('offers all and the seven normalized sports in the filter', async () => {
      const { el, load } = await setup();
      await load(stats(), page([activity(1)]));
      const values = Array.from(
        q<HTMLSelectElement>(el, 'sport-filter')!.querySelectorAll('option'),
      ).map((o) => o.value);
      expect(values).toEqual([
        'all',
        'running',
        'cycling',
        'swimming',
        'walking',
        'hiking',
        'strength',
        'other',
      ]);
    });
  });

  describe('content', () => {
    it('shows the totals', async () => {
      const { el, load } = await setup();
      await load(stats(), page([activity(1)]));
      const totals = q(el, 'totals')!.textContent!;
      expect(totals).toContain('3');
      expect(totals).toContain('30,5 km');
      expect(totals).toContain('3:00');
      expect(totals).toContain('410 m');
    });

    it('renders the activity rows with translated sport and the activity local time', async () => {
      const { el, load } = await setup();
      await load(
        stats(),
        page([
          activity(1, {
            sport: 'cycling',
            start_time: '2026-11-20T23:30:00Z',
            utc_offset_seconds: 3600,
          }),
        ]),
      );
      const text = q(el, 'activity-row')!.textContent!;
      expect(text).toContain(itJson.sport.cycling);
      // 23:30 UTC + 1h = 00:30 del giorno dopo nell'ora locale dell'attività
      expect(text).toContain('21/11/26');
      expect(text).toContain('00:30');
      expect(text).toContain('10,0 km');
      expect(text).toContain('1:00');
      expect(text).toContain('123 m');
      expect(text).toContain('152');
    });

    it('shows a dash for missing values', async () => {
      const { el, load } = await setup();
      await load(
        stats(),
        page([
          activity(1, { distance_m: null, elevation_gain_m: null, avg_hr: null, moving_s: null }),
        ]),
      );
      const cells = Array.from(q(el, 'activity-row')!.querySelectorAll('td')).map((c) =>
        c.textContent!.trim(),
      );
      // distanza, dislivello, FC media mancanti; la durata ripiega sul tempo trascorso (3700 s)
      expect(cells.filter((t) => t === '—').length).toBe(3);
      expect(cells).toContain('1:01');
    });

    it('uses the browser timezone when the offset is missing', async () => {
      const { el, load } = await setup();
      await load(
        stats(),
        page([activity(1, { start_time: '2026-11-20T08:30:00Z', utc_offset_seconds: null })]),
      );
      const expected = new Intl.DateTimeFormat('it', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date('2026-11-20T08:30:00Z'));
      expect(q(el, 'activity-row')!.textContent).toContain(expected);
    });

    it('paginates: next page requests page=2 without reloading the stats', async () => {
      const { el, fixture, ctrl, load, listReq } = await setup();
      await load(stats(), page([activity(1)], { total: 25 }));
      expect(q(el, 'pager')!.textContent).toContain('Pagina 1 di 3');
      q<HTMLButtonElement>(el, 'next-page')!.click();
      fixture.detectChanges();
      await fixture.whenStable();
      const l = listReq();
      expect(l.request.params.get('page')).toBe('2');
      ctrl.expectNone((r) => r.url === '/api/stats/summary');
      l.flush(page([activity(2)], { total: 25, page: 2 }));
    });

    it('goes back to page 1 when the range changes', async () => {
      const { el, fixture, load, statsReq, listReq } = await setup();
      await load(stats(), page([activity(1)], { total: 25 }));
      q<HTMLButtonElement>(el, 'next-page')!.click();
      fixture.detectChanges();
      await fixture.whenStable();
      listReq().flush(page([activity(2)], { total: 25, page: 2 }));
      await fixture.whenStable();
      q<HTMLButtonElement>(el, 'preset-7d')!.click();
      fixture.detectChanges();
      await fixture.whenStable();
      statsReq();
      expect(listReq().request.params.get('page')).toBe('1');
    });

    it('uses cards instead of the table on Handset', async () => {
      const { el, load } = await setup({ handset: true });
      await load(stats(), page([activity(1), activity(2)]));
      expect(qa(el, 'activity-card').length).toBe(2);
      expect(el.querySelector('table')).toBeNull();
      const text = qa(el, 'activity-card')[0].textContent!;
      expect(text).toContain(`${itJson.dashboard.list.distance} 10,0 km`);
      expect(text).toContain(`${itJson.dashboard.list.duration} 1:00`);
      expect(text).toContain(`${itJson.dashboard.list.elevation} 123 m`);
      expect(text).toContain(`${itJson.dashboard.list.avgHr} 152`);
    });

    it('uses the table on desktop', async () => {
      const { el, load } = await setup();
      await load(stats(), page([activity(1), activity(2)]));
      expect(qa(el, 'activity-row').length).toBe(2);
      expect(qa(el, 'activity-card').length).toBe(0);
    });
  });

  describe('charts', () => {
    it('renders the bar chart in km (1 decimal) with per-granularity labels, and the donut by moving time', async () => {
      const { load } = await setup();
      await load(stats(), page([activity(1)]));
      const bar = await lastOption('bar');
      expect(bar.xAxis.data).toEqual(['sett. 09/11', 'sett. 16/11']);
      expect(bar.series[0].data).toEqual([10, 20.5]);
      const donut = await lastOption('pie');
      expect(donut.series[0].data).toEqual([
        { name: itJson.sport.running, value: 7200 },
        { name: itJson.sport.cycling, value: 3600 },
      ]);
    });

    it('re-renders the charts with the new language on language change', async () => {
      const { fixture, load } = await setup();
      await load(stats(), page([activity(1)]));
      await lastOption('bar');
      setOption.mockClear();
      TestBed.inject(TranslocoService).setActiveLang('en');
      fixture.detectChanges();
      await fixture.whenStable();
      expect((await lastOption('bar')).xAxis.data).toEqual(['wk 09/11', 'wk 16/11']);
      const donut = await lastOption('pie');
      expect((donut.series[0].data[0] as { name: string }).name).toBe('Running');
    });
  });

  describe('empty state', () => {
    it('empty state when totals.count is 0: no charts, link to import', async () => {
      const { el, load } = await setup();
      await load(emptyStats(), page([]));
      expect(q(el, 'empty-state')).not.toBeNull();
      expect(el.querySelector('[echarts]')).toBeNull();
      expect(setOption).not.toHaveBeenCalled();
      expect(qa(el, 'activity-row').length).toBe(0);
      expect(q<HTMLAnchorElement>(el, 'empty-import-link')!.getAttribute('href')).toBe('/import');
    });

    it('hides the import link in readOnly', async () => {
      const { el, load } = await setup({ readOnly: true });
      await load(emptyStats(), page([]));
      expect(q(el, 'empty-state')).not.toBeNull();
      expect(q(el, 'empty-import-link')).toBeNull();
    });
  });

  describe('delete', () => {
    interface Settleable {
      detectChanges(): void;
      whenStable(): Promise<unknown>;
    }
    const press = async (fixture: Settleable, testId: string) => {
      fixture.detectChanges();
      await fixture.whenStable();
      const button = document.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`);
      expect(button).not.toBeNull();
      button!.click();
      fixture.detectChanges();
      await fixture.whenStable();
    };

    it('delete -> confirm -> DELETE /api/activities/:id -> reloads stats and list', async () => {
      const { el, fixture, ctrl, load, statsReq, listReq } = await setup();
      await load(stats(), page([activity(7)]));
      q<HTMLButtonElement>(el, 'delete-7')!.click();
      await press(fixture, 'confirm-ok');
      const del = await vi.waitFor(() =>
        ctrl.expectOne({ method: 'DELETE', url: '/api/activities/7' }),
      );
      del.flush(null, { status: 204, statusText: 'No Content' });
      fixture.detectChanges();
      await fixture.whenStable();
      statsReq().flush(stats());
      listReq().flush(page([]));
      ctrl.verify();
    });

    it('cancelling the dialog does not delete', async () => {
      const { el, fixture, ctrl, load } = await setup();
      await load(stats(), page([activity(7)]));
      q<HTMLButtonElement>(el, 'delete-7')!.click();
      await press(fixture, 'confirm-cancel');
      ctrl.expectNone({ method: 'DELETE', url: '/api/activities/7' });
    });

    it('shows a delete error in a snackbar', async () => {
      const { el, fixture, ctrl, load } = await setup();
      await load(stats(), page([activity(7)]));
      q<HTMLButtonElement>(el, 'delete-7')!.click();
      await press(fixture, 'confirm-ok');
      const del = await vi.waitFor(() =>
        ctrl.expectOne({ method: 'DELETE', url: '/api/activities/7' }),
      );
      del.flush(
        { error: 'x', code: 'NOT_FOUND', status: 404 },
        { status: 404, statusText: 'Not Found' },
      );
      fixture.detectChanges();
      await fixture.whenStable();
      const snack = document.querySelector('.mat-mdc-snack-bar-container');
      expect(snack?.textContent).toContain(itJson.errors.NOT_FOUND);
    });

    it('readOnly hides the delete buttons', async () => {
      const { el, load } = await setup({ readOnly: true });
      await load(stats(), page([activity(7)]));
      expect(qa(el, 'activity-row').length).toBe(1);
      expect(q(el, 'delete-7')).toBeNull();
    });

    it('readOnly hides the delete buttons on Handset too', async () => {
      const { el, load } = await setup({ readOnly: true, handset: true });
      await load(stats(), page([activity(7)]));
      expect(qa(el, 'activity-card').length).toBe(1);
      expect(q(el, 'delete-7')).toBeNull();
    });

    it('shows delete on Handset cards', async () => {
      const { el, load } = await setup({ handset: true });
      await load(stats(), page([activity(7)]));
      expect(q(el, 'delete-7')).not.toBeNull();
    });
  });

  describe('errors', () => {
    it('shows the translated error and emits accessDenied on 403 ATHLETE_ACCESS_DENIED', async () => {
      const { el, denied, statsReq, listReq, settle } = await setup({ athleteId: 9 });
      const body = { error: 'no', code: 'ATHLETE_ACCESS_DENIED', status: 403 };
      statsReq().flush(body, { status: 403, statusText: 'Forbidden' });
      listReq().flush(body, { status: 403, statusText: 'Forbidden' });
      await settle();
      expect(q(el, 'error')!.textContent).toContain(itJson.errors.ATHLETE_ACCESS_DENIED);
      expect(denied).toHaveBeenCalledTimes(1);
    });

    it('does not emit accessDenied for other errors', async () => {
      const { el, denied, statsReq, listReq, settle } = await setup();
      const body = { error: 'x', code: 'INTERNAL', status: 500 };
      statsReq().flush(body, { status: 500, statusText: 'Server Error' });
      listReq().flush(body, { status: 500, statusText: 'Server Error' });
      await settle();
      expect(q(el, 'error')!.textContent).toContain(itJson.errors.INTERNAL);
      expect(denied).not.toHaveBeenCalled();
    });

    it('treats a network error as a generic error', async () => {
      const { el, statsReq, listReq, settle } = await setup();
      statsReq().error(new ProgressEvent('error'));
      listReq().error(new ProgressEvent('error'));
      await settle();
      expect(q(el, 'error')!.textContent).toContain(itJson.errors.GENERIC);
    });
  });
});
