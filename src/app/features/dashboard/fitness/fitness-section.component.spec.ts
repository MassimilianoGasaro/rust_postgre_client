import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideEchartsCore } from 'ngx-echarts';
import { Activity, Me } from '../../../core/api/models';
import { translocoTesting } from '../../../testing';
import { FitnessSectionComponent } from './fitness-section.component';

const activity = (id: number, day: string, over: Partial<Activity> = {}): Activity => ({
  id,
  source: 'file_upload',
  sport: 'running',
  sport_raw: 'running',
  name: null,
  start_time: `${day}T07:00:00Z`,
  utc_offset_seconds: 3600,
  elapsed_s: 3700,
  moving_s: 3600,
  distance_m: 10000,
  elevation_gain_m: null,
  avg_hr: 140,
  max_hr: 170,
  avg_speed_mps: 2.8,
  avg_power_w: null,
  avg_cadence: null,
  calories: null,
  file_format: 'fit',
  ...over,
});

const me = (maxHr: number | null, restingHr: number | null): Me => ({
  id: 1,
  email: 'a@example.com',
  username: 'a',
  role: 'athlete',
  created_at: '2026-01-01T00:00:00Z',
  profile: {
    language: 'it',
    timezone: 'Europe/Rome',
    birth_date: null,
    sex: null,
    weight_kg: null,
    max_hr: maxHr,
    resting_hr: restingHr,
    ftp_watts: null,
    threshold_pace_s_per_km: null,
  },
});

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

interface Options {
  sport?: string;
  athleteId?: number | null;
}

function setup(options: Options = {}) {
  TestBed.configureTestingModule({
    imports: [FitnessSectionComponent, translocoTesting()],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideEchartsCore({ echarts: { init: () => fakeChart } }),
    ],
  });
  const ctrl = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(FitnessSectionComponent);
  fixture.componentRef.setInput('range', { from: '2026-11-02', to: '2026-11-29' });
  fixture.componentRef.setInput('sportFilter', options.sport ?? 'all');
  fixture.componentRef.setInput('athleteId', options.athleteId ?? null);
  fixture.componentRef.setInput('ctx', { lang: 'it', t: (k: string) => k });
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const q = (id: string) => el.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const activitiesReq = () =>
    ctrl.expectOne((r) => r.url === '/api/activities' && r.params.get('per_page') === '100');
  return { ctrl, fixture, el, q, settle, activitiesReq };
}

describe('FitnessSectionComponent', () => {
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
  afterEach(() => vi.unstubAllGlobals());

  it('loads all running activities of the range and shows KPIs and charts', async () => {
    const { ctrl, q, el, settle, activitiesReq } = setup();
    ctrl.expectOne('/api/users/me').flush(me(190, 50));
    const req = activitiesReq();
    expect(req.request.params.get('sport')).toBe('running');
    expect(req.request.params.get('from')).toBe('2026-11-02');
    expect(req.request.params.get('page')).toBe('1');
    req.flush({
      items: [activity(1, '2026-11-03'), activity(2, '2026-11-26', { avg_speed_mps: 3 })],
      total: 2,
      page: 1,
      per_page: 100,
    });
    await settle();
    expect(q('fitness-kpis')).not.toBeNull();
    // zona 2 da Karvonen: 134–148 bpm
    expect(q('fitness-kpis')!.textContent).toContain('134–148');
    expect((q('band-min') as HTMLInputElement).value).toBe('134');
    expect(q('fitness-scope')!.textContent).toContain('zona 2 calcolata dal profilo');
    for (const id of ['chart-efficiency', 'chart-pace-hr', 'chart-band', 'chart-endurance']) {
      expect(el.querySelector(`[data-testid="${id}"]`)).not.toBeNull();
    }
    ctrl.verify();
  });

  it('downloads every page of a long period', async () => {
    const { ctrl, settle, activitiesReq } = setup();
    ctrl.expectOne('/api/users/me').flush(me(null, null));
    activitiesReq().flush({ items: [], total: 250, page: 1, per_page: 100 });
    const rest = ctrl.match((r) => r.url === '/api/activities');
    expect(rest.map((r) => r.request.params.get('page'))).toEqual(['2', '3']);
    rest.forEach((r) => r.flush({ items: [], total: 250, page: 2, per_page: 100 }));
    await settle();
    ctrl.verify();
  });

  it('shows an empty state with fewer than 2 valid activities', async () => {
    const { ctrl, q, settle, activitiesReq } = setup();
    ctrl.expectOne('/api/users/me').flush(me(null, null));
    activitiesReq().flush({
      items: [activity(1, '2026-11-03')],
      total: 1,
      page: 1,
      per_page: 100,
    });
    await settle();
    expect(q('fitness-empty')).not.toBeNull();
    expect(q('fitness-kpis')).toBeNull();
  });

  it('does not load anything for unsupported sports', async () => {
    const { ctrl, q, settle } = setup({ sport: 'swimming' });
    ctrl.expectOne('/api/users/me').flush(me(null, null));
    await settle();
    expect(q('fitness-unsupported')).not.toBeNull();
    ctrl.verify();
  });

  it('in coach view skips the profile and uses the default band', async () => {
    const { ctrl, q, settle, activitiesReq } = setup({ athleteId: 42 });
    ctrl.expectNone('/api/users/me');
    const req = activitiesReq();
    expect(req.request.params.get('athlete_id')).toBe('42');
    req.flush({ items: [], total: 0, page: 1, per_page: 100 });
    await settle();
    expect((q('band-min') as HTMLInputElement).value).toBe('135');
    expect((q('band-max') as HTMLInputElement).value).toBe('150');
  });

  it('accepts a valid band and rejects an inverted one', async () => {
    const { ctrl, q, settle, activitiesReq } = setup({ athleteId: 42 });
    activitiesReq().flush({
      items: [activity(1, '2026-11-03'), activity(2, '2026-11-26')],
      total: 2,
      page: 1,
      per_page: 100,
    });
    await settle();
    const min = q('band-min') as HTMLInputElement;
    min.value = '120';
    min.dispatchEvent(new Event('change'));
    await settle();
    expect(q('fitness-kpis')!.textContent).toContain('120–150');

    min.value = '160';
    min.dispatchEvent(new Event('change'));
    await settle();
    expect(min.value).toBe('120');
    expect(q('fitness-kpis')!.textContent).toContain('120–150');
  });

  it('shows the error when activities cannot be loaded', async () => {
    const { ctrl, q, settle, activitiesReq } = setup({ athleteId: 42 });
    activitiesReq().flush({ code: 'INTERNAL' }, { status: 500, statusText: 'Server Error' });
    await settle();
    expect(q('fitness-error')).not.toBeNull();
    ctrl.verify();
  });
});
