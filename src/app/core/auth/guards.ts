import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { Role } from '../api/models';

/** Solo utenti autenticati; gli anonimi vanno a /login. */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isLoggedIn() ? true : inject(Router).createUrlTree(['/login']);
};

/** Solo anonimi (login/registrazione); chi è già dentro va alla propria home. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const role = auth.role();
  return role === null ? true : inject(Router).createUrlTree([auth.homeFor(role)]);
};

/** Solo il ruolo indicato; altri ruoli vanno alla propria home, gli anonimi a /login. */
export function roleGuard(required: Role): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const role = auth.role();
    if (role === null) return router.createUrlTree(['/login']);
    return role === required ? true : router.createUrlTree([auth.homeFor(role)]);
  };
}
