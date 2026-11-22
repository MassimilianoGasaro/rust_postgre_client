import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { UserInfo } from '../api/models';

const STORAGE_KEY = 'rp.auth';
const user: UserInfo = { id: 1, email: 'a@b.it', username: 'ada', role: 'athlete' };

/** Costruisce un JWT non firmato con il claim `exp` indicato (secondi Unix). */
function fakeJwt(exp: number): string {
  const b64url = (o: object) =>
    btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: 1, exp })}.sig`;
}

const future = () => Math.floor(Date.now() / 1000) + 3600;
const past = () => Math.floor(Date.now() / 1000) - 60;

function setup() {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  });
  return {
    auth: TestBed.inject(AuthService),
    http: TestBed.inject(HttpTestingController),
    router: TestBed.inject(Router),
  };
}

describe('AuthService', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('login stores token and user in rp.auth and exposes the role', () => {
    const { auth, http } = setup();
    const token = fakeJwt(future());
    let result: UserInfo | undefined;
    auth.login('a@b.it', 'secret').subscribe((u) => (result = u));

    const req = http.expectOne('/api/auth/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'a@b.it', password: 'secret' });
    req.flush({ token, user });

    expect(result).toEqual(user);
    expect(auth.isLoggedIn()).toBe(true);
    expect(auth.role()).toBe('athlete');
    expect(auth.token()).toBe(token);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({ token, user });
  });

  it('register posts the request and logs the user in', () => {
    const { auth, http } = setup();
    const token = fakeJwt(future());
    const coach: UserInfo = { ...user, role: 'coach' };
    auth.register({ email: 'a@b.it', username: 'ada', password: 'pw', role: 'coach' }).subscribe();

    const req = http.expectOne('/api/auth/register');
    expect(req.request.body).toEqual({
      email: 'a@b.it',
      username: 'ada',
      password: 'pw',
      role: 'coach',
    });
    req.flush({ token, user: coach });

    expect(auth.role()).toBe('coach');
    expect(auth.isLoggedIn()).toBe(true);
  });

  it('a failed login leaves the state untouched', () => {
    const { auth, http } = setup();
    let failed = false;
    auth.login('a@b.it', 'bad').subscribe({ error: () => (failed = true) });
    http
      .expectOne('/api/auth/login')
      .flush(
        { error: 'x', code: 'INVALID_CREDENTIALS', status: 401 },
        { status: 401, statusText: 'Unauthorized' },
      );
    expect(failed).toBe(true);
    expect(auth.isLoggedIn()).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('restores a valid session from rp.auth at startup', () => {
    const token = fakeJwt(future());
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user }));
    const { auth } = setup();
    expect(auth.isLoggedIn()).toBe(true);
    expect(auth.user()).toEqual(user);
  });

  it('discards a session whose JWT exp is in the past', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: fakeJwt(past()), user }));
    const { auth } = setup();
    expect(auth.isLoggedIn()).toBe(false);
    expect(auth.token()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it.each([
    ['malformed token', { token: 'not-a-jwt', user }],
    ['non-base64 payload', { token: 'a.%%%.c', user }],
    ['payload without exp', { token: `a.${btoa('{"sub":1}')}.c`, user }],
    ['missing user', { token: fakeJwt(future()) }],
  ])('treats %s in rp.auth as invalid', (_name, stored) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    const { auth } = setup();
    expect(auth.isLoggedIn()).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('treats unparsable JSON in rp.auth as logged out', () => {
    localStorage.setItem(STORAGE_KEY, '{oops');
    const { auth } = setup();
    expect(auth.isLoggedIn()).toBe(false);
  });

  it('logout clears state and storage and navigates to /login', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: fakeJwt(future()), user }));
    const { auth, router } = setup();
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    auth.logout();
    expect(auth.isLoggedIn()).toBe(false);
    expect(auth.role()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/login'], undefined);
  });

  it('logout("expired") navigates to /login?expired=1', () => {
    const { auth, router } = setup();
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    auth.logout('expired');
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { expired: 1 } });
  });

  it('homeFor maps roles to their landing page', () => {
    const { auth } = setup();
    expect(auth.homeFor('athlete')).toBe('/dashboard');
    expect(auth.homeFor('coach')).toBe('/coach/athletes');
  });
});
