import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PendingRequestsService } from './pending-requests.service';

function setup() {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  return {
    service: TestBed.inject(PendingRequestsService),
    ctrl: TestBed.inject(HttpTestingController),
  };
}

const pendingList = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: i + 1, status: 'pending' }));

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

  it('keeps the previous count when the refresh fails', () => {
    const { service, ctrl } = setup();
    service.set(2);
    service.refresh();
    ctrl.expectOne('/api/coach-links?status=pending').flush('x', { status: 500, statusText: 'E' });
    expect(service.count()).toBe(2);
  });

  it('a newer refresh supersedes the one in flight', () => {
    const { service, ctrl } = setup();
    service.refresh();
    const first = ctrl.expectOne('/api/coach-links?status=pending');
    service.refresh();
    expect(first.cancelled).toBe(true);
    ctrl.expectOne('/api/coach-links?status=pending').flush(pendingList(1));
    expect(service.count()).toBe(1);
  });

  it('clear resets the count and drops the request in flight', () => {
    const { service, ctrl } = setup();
    service.set(4);
    service.refresh();
    const req = ctrl.expectOne('/api/coach-links?status=pending');
    service.clear();
    expect(req.cancelled).toBe(true);
    expect(service.count()).toBe(0);
  });
});
