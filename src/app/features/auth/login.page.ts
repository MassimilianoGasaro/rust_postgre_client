import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { LanguageService } from '../../core/i18n/language.service';
import { errorKey } from '../../core/api/errors';
import { AUTH_PAGE_STYLES } from './auth-page.styles';

@Component({
  selector: 'app-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    TranslocoPipe,
  ],
  styles: AUTH_PAGE_STYLES,
  template: `
    <main class="auth-page">
      <h1>{{ 'app.title' | transloco }}</h1>
      <h2>{{ 'auth.loginTitle' | transloco }}</h2>

      @if (expired) {
        <p class="notice" role="status">{{ 'auth.sessionExpired' | transloco }}</p>
      }
      @if (error()) {
        <p class="error" role="alert">{{ error()! | transloco }}</p>
      }

      <form [formGroup]="form" (ngSubmit)="submit()">
        <mat-form-field appearance="outline">
          <mat-label>{{ 'auth.email' | transloco }}</mat-label>
          <input matInput type="email" formControlName="email" autocomplete="username" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'auth.password' | transloco }}</mat-label>
          <input
            matInput
            type="password"
            formControlName="password"
            autocomplete="current-password"
          />
        </mat-form-field>
        <button mat-flat-button type="submit" [disabled]="form.invalid || busy()">
          {{ 'auth.login' | transloco }}
        </button>
      </form>

      <p class="alt">
        {{ 'auth.noAccount' | transloco }}
        <a routerLink="/register">{{ 'auth.register' | transloco }}</a>
      </p>
    </main>
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly language = inject(LanguageService);

  /** Sessione chiusa dall'interceptor (`/login?expired=1`). */
  protected readonly expired = inject(ActivatedRoute).snapshot.queryParamMap.get('expired') === '1';

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.pattern(/@/)]],
    password: ['', Validators.required],
  });
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected submit(): void {
    if (this.form.invalid || this.busy()) return;
    const { email, password } = this.form.getRawValue();
    this.busy.set(true);
    this.error.set(null);
    this.auth.login(email, password).subscribe({
      next: (user) => {
        // la lingua del profilo ha la precedenza dopo l'accesso
        this.language.init();
        void this.router.navigateByUrl(this.auth.homeFor(user.role));
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.error.set(errorKey(err));
      },
    });
  }
}
