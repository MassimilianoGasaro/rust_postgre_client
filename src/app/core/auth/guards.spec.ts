import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { signal } from '@angular/core';
import { authGuard, guestGuard, roleGuard } from './guards';
import { AuthService } from './auth.service';
import { Role } from '../api/models';

function run(
  guard: (r: ActivatedRouteSnapshot, s: RouterStateSnapshot) => unknown,
  role: Role | null,
) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: AuthService,
        useValue: {
          isLoggedIn: signal(role !== null),
          role: signal(role),
          homeFor: (r: Role) => (r === 'coach' ? '/coach/athletes' : '/dashboard'),
        },
      },
    ],
  });
  return TestBed.runInInjectionContext(() =>
    guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
  );
}

const path = (t: unknown) => TestBed.inject(Router).serializeUrl(t as UrlTree);

describe('guards', () => {
  it('authGuard lets a logged user through', () => {
    expect(run(authGuard, 'athlete')).toBe(true);
  });

  it('authGuard redirects anonymous users to /login', () => {
    expect(path(run(authGuard, null))).toBe('/login');
  });

  it('guestGuard lets anonymous users through', () => {
    expect(run(guestGuard, null)).toBe(true);
  });

  it('guestGuard redirects a logged coach to /coach/athletes', () => {
    expect(path(run(guestGuard, 'coach'))).toBe('/coach/athletes');
  });

  it('guestGuard redirects a logged athlete to /dashboard', () => {
    expect(path(run(guestGuard, 'athlete'))).toBe('/dashboard');
  });

  it('roleGuard("coach") redirects an athlete to /dashboard', () => {
    const result = run(roleGuard('coach'), 'athlete');
    expect(result).toBeInstanceOf(UrlTree);
    expect(path(result)).toBe('/dashboard');
  });

  it('roleGuard("coach") lets a coach through', () => {
    expect(run(roleGuard('coach'), 'coach')).toBe(true);
  });

  it('roleGuard redirects anonymous users to /login', () => {
    expect(path(run(roleGuard('coach'), null))).toBe('/login');
  });
});
