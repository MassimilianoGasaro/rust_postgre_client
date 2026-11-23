import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { API_BASE_URL, apiBaseUrlInterceptor } from './api-base-url.interceptor';
import { authInterceptor } from '../auth/auth.interceptor';
import { AuthService } from '../auth/auth.service';

function setup(base: string) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([authInterceptor, apiBaseUrlInterceptor])),
      provideHttpClientTesting(),
      { provide: API_BASE_URL, useValue: base },
      { provide: AuthService, useValue: { token: signal('tok'), logout: vi.fn() } },
    ],
  });
  return { http: TestBed.inject(HttpClient), ctrl: TestBed.inject(HttpTestingController) };
}

describe('apiBaseUrlInterceptor', () => {
  it('leaves /api/ requests relative when the base URL is empty', () => {
    const { http, ctrl } = setup('');
    http.get('/api/users/me').subscribe();
    ctrl.expectOne('/api/users/me');
  });

  it('prefixes /api/ requests with the base URL and keeps the Bearer header', () => {
    const { http, ctrl } = setup('https://api.example.com/');
    http.get('/api/users/me').subscribe();
    const req = ctrl.expectOne('https://api.example.com/api/users/me');
    expect(req.request.headers.get('Authorization')).toBe('Bearer tok');
  });

  it('does not touch requests outside /api/', () => {
    const { http, ctrl } = setup('https://api.example.com');
    http.get('/i18n/it.json').subscribe();
    ctrl.expectOne('/i18n/it.json');
  });
});
