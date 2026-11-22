import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

function setup(token: string | null) {
  const logout = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(),
      { provide: AuthService, useValue: { token: signal(token), logout } },
    ],
  });
  return { http: TestBed.inject(HttpClient), ctrl: TestBed.inject(HttpTestingController), logout };
}

const unauthorized = { status: 401, statusText: 'Unauthorized' };

describe('authInterceptor', () => {
  it('adds the Bearer header to /api/ requests when a token exists', () => {
    const { http, ctrl } = setup('tok');
    http.get('/api/users/me').subscribe();
    expect(ctrl.expectOne('/api/users/me').request.headers.get('Authorization')).toBe('Bearer tok');
  });

  it('does not add the header outside /api/', () => {
    const { http, ctrl } = setup('tok');
    http.get('/i18n/it.json').subscribe();
    expect(ctrl.expectOne('/i18n/it.json').request.headers.has('Authorization')).toBe(false);
  });

  it('does not add the header without a token', () => {
    const { http, ctrl } = setup(null);
    http.get('/api/users/me').subscribe();
    expect(ctrl.expectOne('/api/users/me').request.headers.has('Authorization')).toBe(false);
  });

  it('calls logout("expired") on a 401 from /api/activities', () => {
    const { http, ctrl, logout } = setup('tok');
    http.get('/api/activities').subscribe({ error: () => undefined });
    ctrl.expectOne('/api/activities').flush({}, unauthorized);
    expect(logout).toHaveBeenCalledWith('expired');
  });

  it('does not log out on a 401 from /api/auth/login (wrong credentials)', () => {
    const { http, ctrl, logout } = setup(null);
    http.post('/api/auth/login', {}).subscribe({ error: () => undefined });
    ctrl.expectOne('/api/auth/login').flush({}, unauthorized);
    expect(logout).not.toHaveBeenCalled();
  });

  it('does not log out on non-401 errors and still propagates the error', () => {
    const { http, ctrl, logout } = setup('tok');
    let status = 0;
    http.get('/api/activities').subscribe({ error: (e) => (status = e.status) });
    ctrl.expectOne('/api/activities').flush({}, { status: 403, statusText: 'Forbidden' });
    expect(logout).not.toHaveBeenCalled();
    expect(status).toBe(403);
  });
});
