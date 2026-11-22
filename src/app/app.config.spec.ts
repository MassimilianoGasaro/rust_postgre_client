import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { appConfig } from './app.config';
import { AuthService } from './core/auth/auth.service';

describe('appConfig', () => {
  it('registers the auth interceptor: HttpClient requests carry the bearer token', () => {
    TestBed.configureTestingModule({
      providers: [
        ...appConfig.providers,
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { token: signal('tok'), logout: vi.fn() } },
      ],
    });
    TestBed.inject(HttpClient).get('/api/users/me').subscribe();
    const req = TestBed.inject(HttpTestingController).expectOne('/api/users/me');
    expect(req.request.headers.get('Authorization')).toBe('Bearer tok');
  });
});
