import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { routes } from './app.routes';
import { LanguageService } from './core/i18n/language.service';
import { translocoTesting } from './testing';

/** JWT fittizio con solo il claim `exp` (basta a AuthService per considerare valida la sessione). */
function jwt(expSecondsFromNow: number): string {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expSecondsFromNow }));
  return `h.${payload}.s`;
}

async function setup(role: 'athlete' | 'coach' | null) {
  localStorage.clear();
  if (role) {
    localStorage.setItem(
      'rp.auth',
      JSON.stringify({ token: jwt(3600), user: { id: 1, email: 'a@b.it', username: 'abc', role } }),
    );
  }
  TestBed.configureTestingModule({
    imports: [translocoTesting()],
    providers: [
      provideRouter(routes),
      provideHttpClient(),
      provideHttpClientTesting(),
      {
        provide: LanguageService,
        useValue: { init: vi.fn(), set: vi.fn(), current: signal<'it' | 'en'>('it') },
      },
    ],
  });
  const harness = await RouterTestingHarness.create();
  const router = TestBed.inject(Router);
  /** Naviga e restituisce l'URL finale dopo guardie e redirect. */
  return async (url: string): Promise<string> => {
    await harness.navigateByUrl(url);
    return router.url;
  };
}

describe('routes', () => {
  it('redirects "" to /login when anonymous', async () => {
    const go = await setup(null);
    expect(await go('/')).toBe('/login');
  });

  it('redirects "" to /dashboard for an athlete', async () => {
    const go = await setup('athlete');
    expect(await go('/')).toBe('/dashboard');
  });

  it('redirects "" to /coach/athletes for a coach', async () => {
    const go = await setup('coach');
    expect(await go('/')).toBe('/coach/athletes');
  });

  it('redirects an unknown path to the role home', async () => {
    const go = await setup('athlete');
    expect(await go('/nope/nothing')).toBe('/dashboard');
  });

  it('redirects an unknown path to /login when anonymous', async () => {
    const go = await setup(null);
    expect(await go('/nope')).toBe('/login');
  });

  it('shows /login and /register to anonymous users', async () => {
    const go = await setup(null);
    expect(await go('/login')).toBe('/login');
    expect(await go('/register')).toBe('/register');
  });

  it('keeps anonymous users out of /dashboard', async () => {
    const go = await setup(null);
    expect(await go('/dashboard')).toBe('/login');
  });

  it('keeps logged-in users out of /login and /register', async () => {
    const go = await setup('coach');
    expect(await go('/login')).toBe('/coach/athletes');
    expect(await go('/register')).toBe('/coach/athletes');
  });

  it('keeps athletes out of coach routes', async () => {
    const go = await setup('athlete');
    expect(await go('/coach/requests')).toBe('/dashboard');
    expect(await go('/coach/athletes')).toBe('/dashboard');
    expect(await go('/coach/athletes/3')).toBe('/dashboard');
  });

  it('keeps coaches out of athlete-only routes', async () => {
    const go = await setup('coach');
    expect(await go('/my-coach')).toBe('/coach/athletes');
    expect(await go('/import')).toBe('/coach/athletes');
  });

  it('opens athlete pages for an athlete', async () => {
    const go = await setup('athlete');
    expect(await go('/import')).toBe('/import');
    expect(await go('/my-coach')).toBe('/my-coach');
    expect(await go('/dashboard')).toBe('/dashboard');
  });

  it('lets a coach open /profile', async () => {
    const go = await setup('coach');
    expect(await go('/profile')).toBe('/profile');
  });

  it('lets an athlete open /profile', async () => {
    const go = await setup('athlete');
    expect(await go('/profile')).toBe('/profile');
  });

  it('resolves coach pages including /coach/athletes/:id', async () => {
    const go = await setup('coach');
    expect(await go('/coach/requests')).toBe('/coach/requests');
    expect(await go('/coach/athletes/7')).toBe('/coach/athletes/7');
  });
});
