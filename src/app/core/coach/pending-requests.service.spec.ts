import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PendingRequestsService } from './pending-requests.service';
import { AuthService } from '../auth/auth.service';
import { Role, UserInfo } from '../api/models';

const URL = '/api/coach-links?status=pending';
const user = (id: number, role: Role): UserInfo => ({
  id,
  email: `u${id}@x.it`,
  username: `u${id}`,
  role,
});
const pendingList = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: i + 1, status: 'pending' }));
const fail = { status: 500, statusText: 'E' };

function setup(initial: UserInfo | null = user(1, 'coach')) {
  const current = signal<UserInfo | null>(initial);
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: AuthService, useValue: { user: current } },
    ],
  });
  return {
    current,
    service: TestBed.inject(PendingRequestsService),
    ctrl: TestBed.inject(HttpTestingController),
  };
}

describe('PendingRequestsService', () => {
  it('starts at 0', () => {
    expect(setup().service.count()).toBe(0);
  });

  it('refresh loads the pending links and stores their number', () => {
    const { service, ctrl } = setup();
    service.refresh();
    const req = ctrl.expectOne((r) => r.url === '/api/coach-links');
    expect(req.request.params.get('status')).toBe('pending');
    req.flush(pendingList(3));
    expect(service.count()).toBe(3);
  });

  it('does nothing without a logged-in user', () => {
    const { service, ctrl } = setup(null);
    service.refresh();
    ctrl.expectNone(URL);
    expect(service.count()).toBe(0);
  });

  it('keeps the previous count of the same user when the refresh fails', () => {
    const { service, ctrl } = setup();
    service.set(2);
    service.refresh();
    ctrl.expectOne(URL).flush('x', fail);
    expect(service.count()).toBe(2);
  });

  it('a newer refresh supersedes the one in flight', () => {
    const { service, ctrl } = setup();
    service.refresh();
    const first = ctrl.expectOne(URL);
    service.refresh();
    expect(first.cancelled).toBe(true);
    ctrl.expectOne(URL).flush(pendingList(1));
    expect(service.count()).toBe(1);
  });

  it('clear resets the count and drops the request in flight', () => {
    const { service, ctrl } = setup();
    service.set(4);
    service.refresh();
    const req = ctrl.expectOne(URL);
    service.clear();
    expect(req.cancelled).toBe(true);
    expect(service.count()).toBe(0);
  });

  describe('across sessions', () => {
    it('logout hides the count even if nothing calls clear', () => {
      const { service, current, ctrl } = setup(user(1, 'coach'));
      service.refresh();
      ctrl.expectOne(URL).flush(pendingList(3));
      expect(service.count()).toBe(3);
      current.set(null);
      expect(service.count()).toBe(0);
    });

    it('coach A (3) -> logout -> coach B with a failing refresh: nothing is shown', () => {
      const { service, current, ctrl } = setup(user(1, 'coach'));
      service.refresh();
      ctrl.expectOne(URL).flush(pendingList(3));
      current.set(null);
      current.set(user(2, 'coach'));
      expect(service.count()).toBe(0);
      service.refresh();
      expect(service.count()).toBe(0);
      ctrl.expectOne(URL).flush('x', fail);
      expect(service.count()).toBe(0);
    });

    it('coach A (3) -> coach B logging in without logout in between: B never sees 3', () => {
      const { service, current, ctrl } = setup(user(1, 'coach'));
      service.refresh();
      ctrl.expectOne(URL).flush(pendingList(3));
      current.set(user(2, 'coach'));
      expect(service.count()).toBe(0);
      service.refresh();
      ctrl.expectOne(URL).flush('x', fail);
      expect(service.count()).toBe(0);
    });

    it('coach -> athlete: the count is hidden', () => {
      const { service, current, ctrl } = setup(user(1, 'coach'));
      service.refresh();
      ctrl.expectOne(URL).flush(pendingList(3));
      current.set(user(1, 'athlete'));
      expect(service.count()).toBe(0);
    });

    it('a response arriving after the user changed is ignored', () => {
      const { service, current, ctrl } = setup(user(1, 'coach'));
      service.refresh();
      const late = ctrl.expectOne(URL);
      current.set(user(2, 'coach'));
      late.flush(pendingList(5));
      expect(service.count()).toBe(0);
    });
  });
});
