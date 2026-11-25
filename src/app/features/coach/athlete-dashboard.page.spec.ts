import { TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { BreakpointObserver } from '@angular/cdk/layout';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideEchartsCore } from 'ngx-echarts';
import { of } from 'rxjs';
import { AthleteDashboardPage } from './athlete-dashboard.page';
import { Activity, LinkedAthlete, Page, StatsSummary } from '../../core/api/models';
import { TODAY } from '../../core/time/today';
import { translocoTesting } from '../../testing';
import { stubFitnessSection } from '../dashboard/fitness/fitness-section.testing';
import itJson from '../../../../public/i18n/it.json';

const athlete = (id: number, username: string): LinkedAthlete => ({
  id,
  username,
  linked_since: '2026-10-15T08:00:00Z',
});

const ACTIVITY: Activity = {
  id: 1,
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
};

const STATS: StatsSummary = {
  from: '2026-10-24',
  to: '2026-11-22',
  granularity: 'week',
  timezone: 'Europe/Rome',
  totals: { count: 1, distance_m: 10000, moving_s: 3600, elapsed_s: 3700, elevation_gain_m: 123 },
  by_sport: [{ sport: 'running', count: 1, distance_m: 10000, moving_s: 3600 }],
  series: [
    {
      period_start: '2026-11-16',
      count: 1,
      distance_m: 10000,
      moving_s: 3600,
      elevation_gain_m: 123,
    },
  ],
};

const PAGE: Page<Activity> = { items: [ACTIVITY], total: 1, page: 1, per_page: 10 };

const fakeChart = {
  setOption: vi.fn(),
  resize: vi.fn(),
  dispose: vi.fn(),
  isDisposed: () => false,
  on: vi.fn(),
  off: vi.fn(),
  showLoading: vi.fn(),
  hideLoading: vi.fn(),
};

async function setup(url: string) {
  const snackOpen = vi.fn();
  TestBed.configureTestingModule({
    imports: [translocoTesting()],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([
        { path: 'coach/athletes', children: [] },
        { path: 'coach/athletes/:id', component: AthleteDashboardPage },
      ]),
      provideEchartsCore({ echarts: { init: () => fakeChart } }),
      { provide: TODAY, useValue: () => new Date(2026, 10, 22, 15, 30) },
      { provide: MatSnackBar, useValue: { open: snackOpen } },
      {
        provide: BreakpointObserver,
        useValue: { observe: () => of({ matches: false, breakpoints: {} }) },
      },
    ],
  });
  stubFitnessSection();
  const ctrl = TestBed.inject(HttpTestingController);
  const harness = await RouterTestingHarness.create();
  const settle = async () => {
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
  };
  await harness.navigateByUrl(url);
  return { harness, ctrl, snackOpen, settle, el: harness.routeNativeElement as HTMLElement };
}

type Ctx = Awaited<ReturnType<typeof setup>>;

const statsReq = (ctrl: HttpTestingController) =>
  ctrl.expectOne((r) => r.url === '/api/stats/summary');
const listReq = (ctrl: HttpTestingController) =>
  ctrl.expectOne((r) => r.url === '/api/activities' && r.method === 'GET');

/** Risponde alla lista atleti e poi alle due richieste della dashboard. */
async function loadAll(ctx: Ctx, athletes: LinkedAthlete[]) {
  ctx.ctrl.expectOne('/api/athletes').flush(athletes);
  await ctx.settle();
  statsReq(ctx.ctrl).flush(STATS);
  listReq(ctx.ctrl).flush(PAGE);
  await ctx.settle();
}

const httpErr = (code: string, status: number) => ({
  body: { error: 'x', code, status },
  opts: { status, statusText: 'Err' },
});

describe('AthleteDashboardPage', () => {
  beforeEach(() => {
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

  it('shows the athlete username in the header and loads the dashboard for that athlete', async () => {
    const ctx = await setup('/coach/athletes/5');
    ctx.ctrl.expectOne('/api/athletes').flush([athlete(4, 'luca'), athlete(5, 'mario')]);
    await ctx.settle();
    expect(ctx.el.querySelector('h1')!.textContent).toContain('mario');
    expect(ctx.el.querySelector('h1')!.textContent).not.toContain('luca');
    const stats = statsReq(ctx.ctrl);
    const list = listReq(ctx.ctrl);
    expect(stats.request.params.get('athlete_id')).toBe('5');
    expect(list.request.params.get('athlete_id')).toBe('5');
    stats.flush(STATS);
    list.flush(PAGE);
  });

  it('does not request any data until the athlete is known to be accessible', async () => {
    const ctx = await setup('/coach/athletes/5');
    ctx.ctrl.expectNone((r) => r.url === '/api/stats/summary');
    ctx.ctrl.expectNone((r) => r.url === '/api/activities');
    ctx.ctrl.expectOne('/api/athletes').flush([athlete(5, 'mario')]);
    await ctx.settle();
    statsReq(ctx.ctrl).flush(STATS);
    listReq(ctx.ctrl).flush(PAGE);
  });

  it('renders the dashboard read-only: activities are listed without delete buttons', async () => {
    const ctx = await setup('/coach/athletes/5');
    await loadAll(ctx, [athlete(5, 'mario')]);
    expect(ctx.el.querySelectorAll('[data-testid="activity-row"]').length).toBeGreaterThan(0);
    expect(ctx.el.querySelector('[data-testid="delete-1"]')).toBeNull();
  });

  it('redirects with a snackbar when the id is not among the active athletes', async () => {
    const ctx = await setup('/coach/athletes/99');
    ctx.ctrl.expectOne('/api/athletes').flush([athlete(5, 'mario')]);
    await ctx.settle();
    expect(ctx.snackOpen).toHaveBeenCalledTimes(1);
    expect(ctx.snackOpen.mock.calls[0][0]).toBe(itJson.errors.ATHLETE_ACCESS_DENIED);
    expect(TestBed.inject(Location).path()).toBe('/coach/athletes');
    ctx.ctrl.expectNone((r) => r.url === '/api/stats/summary');
  });

  it('redirects with a snackbar when the id is not a valid number', async () => {
    const ctx = await setup('/coach/athletes/abc');
    ctx.ctrl.expectOne('/api/athletes').flush([athlete(5, 'mario')]);
    await ctx.settle();
    expect(ctx.snackOpen).toHaveBeenCalledTimes(1);
    expect(TestBed.inject(Location).path()).toBe('/coach/athletes');
  });

  it('403 ATHLETE_ACCESS_DENIED while loading the dashboard shows one snackbar and redirects', async () => {
    const ctx = await setup('/coach/athletes/5');
    ctx.ctrl.expectOne('/api/athletes').flush([athlete(5, 'mario')]);
    await ctx.settle();
    const e = httpErr('ATHLETE_ACCESS_DENIED', 403);
    statsReq(ctx.ctrl).flush(e.body, e.opts);
    listReq(ctx.ctrl).flush(e.body, e.opts);
    await ctx.settle();
    expect(ctx.snackOpen).toHaveBeenCalledTimes(1);
    expect(ctx.snackOpen.mock.calls[0][0]).toBe(itJson.errors.ATHLETE_ACCESS_DENIED);
    expect(TestBed.inject(Location).path()).toBe('/coach/athletes');
  });

  it('shows a translated error and no dashboard when the athletes cannot be loaded', async () => {
    const ctx = await setup('/coach/athletes/5');
    const e = httpErr('INTERNAL', 500);
    ctx.ctrl.expectOne('/api/athletes').flush(e.body, e.opts);
    await ctx.settle();
    expect(ctx.el.textContent).toContain(itJson.errors.INTERNAL);
    expect(ctx.snackOpen).not.toHaveBeenCalled();
    ctx.ctrl.expectNone((r) => r.url === '/api/stats/summary');
  });

  it('navigating to another athlete resets the range and sport to the defaults', async () => {
    const ctx = await setup('/coach/athletes/5?from=2026-01-01&to=2026-01-31&sport=cycling');
    const athletes = [athlete(5, 'mario'), athlete(6, 'luca')];
    ctx.ctrl.expectOne('/api/athletes').flush(athletes);
    await ctx.settle();
    const first = statsReq(ctx.ctrl);
    expect(first.request.params.get('from')).toBe('2026-01-01');
    expect(first.request.params.get('sport')).toBe('cycling');
    first.flush(STATS);
    listReq(ctx.ctrl).flush(PAGE);
    await ctx.settle();

    await ctx.harness.navigateByUrl('/coach/athletes/6');
    await ctx.settle();
    const second = statsReq(ctx.ctrl);
    expect(second.request.params.get('athlete_id')).toBe('6');
    expect(second.request.params.get('from')).toBe('2026-10-24');
    expect(second.request.params.get('to')).toBe('2026-11-22');
    expect(second.request.params.has('sport')).toBe(false);
    const list = listReq(ctx.ctrl);
    expect(list.request.params.get('from')).toBe('2026-10-24');
    expect(list.request.params.get('athlete_id')).toBe('6');
    expect(ctx.el.querySelector('h1')!.textContent).toContain('luca');
    second.flush(STATS);
    list.flush(PAGE);
  });
});
