import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { map, Observable, tap } from 'rxjs';
import { AuthResponse, RegisterRequest, Role, UserInfo } from '../api/models';

const STORAGE_KEY = 'rp.auth';

interface StoredAuth {
  token: string;
  user: UserInfo;
}

/** Legge il claim `exp` (secondi Unix) dal payload del JWT; `null` se il token non è decodificabile. */
function jwtExpiry(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    // base64url -> base64 con padding, poi decodifica UTF-8
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
    const claims: unknown = JSON.parse(new TextDecoder().decode(bytes));
    const exp = (claims as { exp?: unknown } | null)?.exp;
    return typeof exp === 'number' && Number.isFinite(exp) ? exp : null;
  } catch {
    return null;
  }
}

function isUserInfo(value: unknown): value is UserInfo {
  const u = value as Partial<UserInfo> | null;
  return (
    u !== null &&
    typeof u === 'object' &&
    typeof u.id === 'number' &&
    typeof u.email === 'string' &&
    typeof u.username === 'string' &&
    (u.role === 'athlete' || u.role === 'coach')
  );
}

function readStorage(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as Partial<StoredAuth> | null;
    if (!stored || typeof stored.token !== 'string' || !isUserInfo(stored.user)) {
      return null;
    }
    const exp = jwtExpiry(stored.token);
    if (exp === null || exp * 1000 <= Date.now()) return null;
    return { token: stored.token, user: stored.user };
  } catch {
    return null;
  }
}

function clearStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage non disponibile: nulla da pulire
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly state = signal<StoredAuth | null>(null);

  readonly user = computed(() => this.state()?.user ?? null);
  readonly token = computed(() => this.state()?.token ?? null);
  readonly role = computed<Role | null>(() => this.user()?.role ?? null);
  readonly isLoggedIn = computed(() => this.state() !== null);

  constructor() {
    const stored = readStorage();
    if (stored) {
      this.state.set(stored);
    } else {
      // sessione assente, malformata o scaduta: scarta ciò che resta
      clearStorage();
    }
  }

  login(email: string, password: string): Observable<UserInfo> {
    return this.http.post<AuthResponse>('/api/auth/login', { email, password }).pipe(
      tap((res) => this.start(res)),
      map((res) => res.user),
    );
  }

  register(req: RegisterRequest): Observable<UserInfo> {
    return this.http.post<AuthResponse>('/api/auth/register', req).pipe(
      tap((res) => this.start(res)),
      map((res) => res.user),
    );
  }

  logout(reason?: 'expired'): void {
    this.state.set(null);
    clearStorage();
    void this.router.navigate(['/login'], reason ? { queryParams: { expired: 1 } } : undefined);
  }

  homeFor(role: Role): string {
    return role === 'coach' ? '/coach/athletes' : '/dashboard';
  }

  private start(res: AuthResponse): void {
    const stored: StoredAuth = { token: res.token, user: res.user };
    this.state.set(stored);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch {
      // storage non disponibile: la sessione vale solo per questa visita
    }
  }
}
