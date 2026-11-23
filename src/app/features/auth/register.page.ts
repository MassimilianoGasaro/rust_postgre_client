import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { LanguageService } from '../../core/i18n/language.service';
import { errorKey } from '../../core/api/errors';
import { Role } from '../../core/api/models';
import { LanguageToggleComponent } from '../../shared/language-toggle.component';
import { AUTH_PAGE_STYLES } from './auth-page.styles';

@Component({
  selector: 'app-register-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatRadioModule,
    LanguageToggleComponent,
    TranslocoPipe,
  ],
  styles: AUTH_PAGE_STYLES,
  template: `
    <main class="auth-page">
      <div class="lang-row"><app-language-toggle /></div>
      <h1>{{ 'app.title' | transloco }}</h1>
      <h2>{{ 'auth.registerTitle' | transloco }}</h2>

      @if (error()) {
        <p class="error" role="alert">{{ error()! | transloco }}</p>
      }

      <form [formGroup]="form" (ngSubmit)="submit()">
        <mat-form-field appearance="outline">
          <mat-label>{{ 'auth.email' | transloco }}</mat-label>
          <input matInput type="email" formControlName="email" autocomplete="email" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'auth.username' | transloco }}</mat-label>
          <input matInput type="text" formControlName="username" autocomplete="username" />
          <mat-hint>{{ 'auth.usernameHint' | transloco }}</mat-hint>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'auth.password' | transloco }}</mat-label>
          <input matInput type="password" formControlName="password" autocomplete="new-password" />
          <mat-hint>{{ 'auth.passwordHint' | transloco }}</mat-hint>
        </mat-form-field>

        <fieldset>
          <legend>{{ 'auth.role' | transloco }}</legend>
          <mat-radio-group formControlName="role" [attr.aria-label]="'auth.role' | transloco">
            <mat-radio-button value="athlete">{{
              'auth.roleAthlete' | transloco
            }}</mat-radio-button>
            <mat-radio-button value="coach">{{ 'auth.roleCoach' | transloco }}</mat-radio-button>
          </mat-radio-group>
        </fieldset>

        <button mat-flat-button type="submit" [disabled]="form.invalid || busy()">
          {{ 'auth.register' | transloco }}
        </button>
      </form>

      <p class="alt">
        {{ 'auth.haveAccount' | transloco }}
        <a routerLink="/login">{{ 'auth.login' | transloco }}</a>
      </p>
    </main>
  `,
})
export class RegisterPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly language = inject(LanguageService);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.maxLength(255), Validators.pattern(/@/)]],
    // stesse regole del backend: 3-50 caratteri tra lettere ASCII, cifre, _ . -
    username: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9_.-]{3,50}$/)]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    role: ['athlete' as Role],
  });
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected submit(): void {
    if (this.form.invalid || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.auth.register(this.form.getRawValue()).subscribe({
      next: (user) => {
        // il profilo nasce con la lingua di default: allinealo a quella scelta durante la registrazione
        this.language.set(this.language.current());
        void this.router.navigateByUrl(this.auth.homeFor(user.role));
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.error.set(errorKey(err));
      },
    });
  }
}
