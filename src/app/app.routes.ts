import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { AuthService } from './core/auth/auth.service';
import { authGuard, guestGuard, roleGuard } from './core/auth/guards';

/** Destinazione di `''` e `**`: la home del ruolo, oppure /login se non c'è sessione. */
const homeRedirect = () => {
  const auth = inject(AuthService);
  const role = auth.role();
  return role ? auth.homeFor(role) : '/login';
};

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/register.page').then((m) => m.RegisterPage),
  },
  { path: '', pathMatch: 'full', redirectTo: homeRedirect },
  {
    // tutte le pagine protette vivono dentro la shell
    path: '',
    loadComponent: () => import('./layout/shell.component').then((m) => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        canActivate: [roleGuard('athlete')],
        loadComponent: () =>
          import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage),
      },
      {
        path: 'import',
        canActivate: [roleGuard('athlete')],
        loadComponent: () => import('./features/import/import.page').then((m) => m.ImportPage),
      },
      {
        path: 'my-coach',
        canActivate: [roleGuard('athlete')],
        loadComponent: () => import('./features/my-coach/my-coach.page').then((m) => m.MyCoachPage),
      },
      {
        path: 'coach/requests',
        canActivate: [roleGuard('coach')],
        loadComponent: () => import('./features/coach/requests.page').then((m) => m.RequestsPage),
      },
      {
        path: 'coach/athletes',
        canActivate: [roleGuard('coach')],
        loadComponent: () => import('./features/coach/athletes.page').then((m) => m.AthletesPage),
      },
      {
        path: 'coach/athletes/:id',
        canActivate: [roleGuard('coach')],
        loadComponent: () =>
          import('./features/coach/athlete-dashboard.page').then((m) => m.AthleteDashboardPage),
      },
      {
        path: 'profile',
        loadComponent: () => import('./features/profile/profile.page').then((m) => m.ProfilePage),
      },
    ],
  },
  { path: '**', redirectTo: homeRedirect },
];
