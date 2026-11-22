import { TestBed } from '@angular/core/testing';
import { HttpEventType, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { UserApi } from './user-api';
import { CoachLinkApi } from './coach-link-api';
import { ImportApi } from './import-api';
import { ActivityApi } from './activity-api';
import { StatsApi } from './stats-api';

let ctrl: HttpTestingController;

beforeEach(() => {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  ctrl = TestBed.inject(HttpTestingController);
});
afterEach(() => ctrl.verify());

describe('UserApi', () => {
  it('me() GETs /api/users/me', () => {
    TestBed.inject(UserApi).me().subscribe();
    expect(ctrl.expectOne('/api/users/me').request.method).toBe('GET');
  });

  it('update() PATCHes the patch including current_password', () => {
    const patch = { email: 'n@b.it', current_password: 'old', weight_kg: null };
    TestBed.inject(UserApi).update(patch).subscribe();
    const req = ctrl.expectOne('/api/users/me');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(patch);
  });

  it('deleteMe() sends DELETE with the current password in the JSON body', () => {
    TestBed.inject(UserApi).deleteMe('pw').subscribe();
    const req = ctrl.expectOne('/api/users/me');
    expect(req.request.method).toBe('DELETE');
    expect(req.request.body).toEqual({ current_password: 'pw' });
  });
});

describe('CoachLinkApi', () => {
  it('request() POSTs the coach identifier', () => {
    TestBed.inject(CoachLinkApi).request('bob').subscribe();
    const req = ctrl.expectOne('/api/coach-links');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ coach: 'bob' });
  });

  it('list() sends the status filter only when given', () => {
    const api = TestBed.inject(CoachLinkApi);
    api.list().subscribe();
    expect(ctrl.expectOne('/api/coach-links').request.params.keys()).toEqual([]);
    api.list('pending').subscribe();
    const req = ctrl.expectOne((r) => r.url === '/api/coach-links');
    expect(req.request.params.get('status')).toBe('pending');
  });

  it.each(['accept', 'reject', 'cancel', 'revoke'] as const)(
    '%s() POSTs /api/coach-links/:id/%s',
    (action) => {
      TestBed.inject(CoachLinkApi)[action](7).subscribe();
      const req = ctrl.expectOne(`/api/coach-links/7/${action}`);
      expect(req.request.method).toBe('POST');
    },
  );

  it('athletes() GETs /api/athletes', () => {
    TestBed.inject(CoachLinkApi).athletes().subscribe();
    expect(ctrl.expectOne('/api/athletes').request.method).toBe('GET');
  });
});

describe('ImportApi', () => {
  it('upload() sends FormData with one repeated `files` entry per file and reports progress', () => {
    const files = [new File(['a'], 'a.fit'), new File(['b'], 'b.gpx')];
    const events: HttpEventType[] = [];
    TestBed.inject(ImportApi)
      .upload(files)
      .subscribe((e) => events.push(e.type));
    const req = ctrl.expectOne('/api/imports');
    expect(req.request.method).toBe('POST');
    expect(req.request.reportProgress).toBe(true);
    const body = req.request.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    const sent = body.getAll('files') as File[];
    expect(sent.map((f) => f.name)).toEqual(['a.fit', 'b.gpx']);
    req.flush({
      id: 1,
      status: 'processing',
      created_at: '2026-01-01T00:00:00Z',
      finished_at: null,
    });
    expect(events).toContain(HttpEventType.Response);
  });

  it('get() and recent() GET the import endpoints', () => {
    const api = TestBed.inject(ImportApi);
    api.get(3).subscribe();
    expect(ctrl.expectOne('/api/imports/3').request.method).toBe('GET');
    api.recent().subscribe();
    expect(ctrl.expectOne('/api/imports').request.method).toBe('GET');
  });
});

describe('ActivityApi', () => {
  it('list() sends only the defined query params', () => {
    TestBed.inject(ActivityApi)
      .list({ from: '2026-01-01', sport: undefined, page: 2, per_page: 20, athlete_id: 5 })
      .subscribe();
    const req = ctrl.expectOne((r) => r.url === '/api/activities');
    expect(req.request.params.get('from')).toBe('2026-01-01');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('per_page')).toBe('20');
    expect(req.request.params.get('athlete_id')).toBe('5');
    expect(req.request.params.has('sport')).toBe(false);
    expect(req.request.params.has('to')).toBe(false);
  });

  it('delete() sends DELETE /api/activities/:id', () => {
    TestBed.inject(ActivityApi).delete(9).subscribe();
    expect(ctrl.expectOne('/api/activities/9').request.method).toBe('DELETE');
  });
});

describe('StatsApi', () => {
  it('summary() sends range plus optional filters', () => {
    TestBed.inject(StatsApi)
      .summary(
        { from: '2026-01-01', to: '2026-01-31' },
        { sport: 'run', granularity: 'week', athlete_id: 4 },
      )
      .subscribe();
    const req = ctrl.expectOne((r) => r.url === '/api/stats/summary');
    expect(req.request.params.get('from')).toBe('2026-01-01');
    expect(req.request.params.get('to')).toBe('2026-01-31');
    expect(req.request.params.get('sport')).toBe('run');
    expect(req.request.params.get('granularity')).toBe('week');
    expect(req.request.params.get('athlete_id')).toBe('4');
  });

  it('summary() omits absent options', () => {
    TestBed.inject(StatsApi).summary({ from: '2026-01-01', to: '2026-01-31' }).subscribe();
    const req = ctrl.expectOne((r) => r.url === '/api/stats/summary');
    expect(req.request.params.keys().sort()).toEqual(['from', 'to']);
  });
});
