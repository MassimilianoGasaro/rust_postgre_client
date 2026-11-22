import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { DateAdapter, MAT_DATE_FORMATS, MAT_NATIVE_DATE_FORMATS } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { merge } from 'rxjs';
import { errorKey } from '../../core/api/errors';
import { Me, UpdateMeRequest } from '../../core/api/models';
import { UserApi } from '../../core/api/user-api';
import { AuthService } from '../../core/auth/auth.service';
import { LanguageService } from '../../core/i18n/language.service';
import { MIN_DATE } from '../../core/time/dates';
import { DATEPICKER_INTL_PROVIDER } from '../../core/i18n/transloco-datepicker-intl';
import { LocalDateAdapter } from '../../core/time/local-date-adapter';
import { TODAY } from '../../core/time/today';
import { DeleteAccountDialogComponent } from './delete-account-dialog.component';
import { buildPatch, formValueFrom, paceToSeconds, timezoneOptions } from './profile-form';

const MAX_SUGGESTIONS = 100;

const integerValidator = (c: AbstractControl): ValidationErrors | null =>
  c.value === null || Number.isInteger(c.value) ? null : { integer: true };

const paceValidator = (c: AbstractControl): ValidationErrors | null =>
  c.value === '' || paceToSeconds(String(c.value)) !== null ? null : { pace: true };

@Component({
  selector: 'app-profile-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    TranslocoPipe,
  ],
  providers: [
    DATEPICKER_INTL_PROVIDER,
    { provide: DateAdapter, useClass: LocalDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: MAT_NATIVE_DATE_FORMATS },
  ],
  styles: `
    :host {
      display: block;
      max-width: 720px;
      margin: 0 auto;
    }
    h1 {
      margin: 0 0 16px;
      font: var(--mat-sys-headline-medium);
    }
    h2 {
      margin: 0 0 12px;
      font: var(--mat-sys-title-medium);
    }
    section {
      margin-bottom: 24px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 0 16px;
    }
    mat-form-field {
      width: 100%;
    }
    .error {
      color: var(--mat-sys-error);
    }
    .danger {
      border-top: 1px solid var(--mat-sys-outline-variant);
      padding-top: 16px;
    }
  `,
  template: `
    <h1>{{ 'profile.title' | transloco }}</h1>

    @if (loadError()) {
      <p class="error" role="alert" data-testid="load-error">{{ loadError()! | transloco }}</p>
    } @else if (me() === null) {
      <p>{{ 'profile.loading' | transloco }}</p>
    } @else {
      <form [formGroup]="form" (ngSubmit)="save()" novalidate>
        <section>
          <h2>{{ 'profile.accountTitle' | transloco }}</h2>
          <div class="grid">
            <mat-form-field appearance="outline">
              <mat-label>{{ 'profile.email' | transloco }}</mat-label>
              <input
                matInput
                type="email"
                autocomplete="email"
                data-testid="email"
                formControlName="email"
              />
              @if (form.controls.email.invalid) {
                <mat-error>{{ 'profile.errors.email' | transloco }}</mat-error>
              }
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'profile.username' | transloco }}</mat-label>
              <input
                matInput
                type="text"
                autocomplete="username"
                data-testid="username"
                formControlName="username"
              />
              @if (form.controls.username.invalid) {
                <mat-error>{{ 'profile.errors.username' | transloco }}</mat-error>
              }
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'profile.newPassword' | transloco }}</mat-label>
              <input
                matInput
                type="password"
                autocomplete="new-password"
                data-testid="password"
                formControlName="password"
              />
              @if (form.controls.password.invalid) {
                <mat-error>{{ 'profile.errors.password' | transloco }}</mat-error>
              } @else {
                <mat-hint>{{ 'profile.newPasswordHint' | transloco }}</mat-hint>
              }
            </mat-form-field>
            @if (needsCurrentPassword()) {
              <mat-form-field appearance="outline">
                <mat-label>{{ 'profile.currentPassword' | transloco }}</mat-label>
                <input
                  matInput
                  type="password"
                  autocomplete="current-password"
                  data-testid="current-password"
                  formControlName="currentPassword"
                />
                <mat-hint>{{ 'profile.currentPasswordHint' | transloco }}</mat-hint>
              </mat-form-field>
            }
          </div>
        </section>

        <section>
          <h2>{{ 'profile.preferencesTitle' | transloco }}</h2>
          <div class="grid">
            <mat-form-field appearance="outline">
              <mat-label>{{ 'profile.language' | transloco }}</mat-label>
              <select matNativeControl data-testid="language" formControlName="language">
                <option value="it">{{ 'profile.languageIt' | transloco }}</option>
                <option value="en">{{ 'profile.languageEn' | transloco }}</option>
              </select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'profile.timezone' | transloco }}</mat-label>
              <input
                matInput
                type="text"
                autocomplete="off"
                data-testid="timezone"
                formControlName="timezone"
                [matAutocomplete]="tzAuto"
              />
              <mat-autocomplete #tzAuto="matAutocomplete">
                @for (zone of suggestions(); track zone) {
                  <mat-option [value]="zone">{{ zone }}</mat-option>
                }
              </mat-autocomplete>
              @if (form.controls.timezone.invalid) {
                <mat-error>{{ 'profile.errors.timezone' | transloco }}</mat-error>
              }
            </mat-form-field>
          </div>
        </section>

        @if (isAthlete()) {
          <section>
            <h2>{{ 'profile.physioTitle' | transloco }}</h2>
            <div class="grid">
              <mat-form-field appearance="outline">
                <mat-label>{{ 'profile.birthDate' | transloco }}</mat-label>
                <input
                  matInput
                  data-testid="birth-date"
                  formControlName="birthDate"
                  [matDatepicker]="birthPicker"
                  [min]="minDate"
                  [max]="maxDate"
                />
                <mat-datepicker-toggle matIconSuffix [for]="birthPicker" />
                <mat-datepicker #birthPicker startView="multi-year" />
                @if (form.controls.birthDate.invalid) {
                  <mat-error>{{ 'profile.errors.birthDate' | transloco }}</mat-error>
                }
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>{{ 'profile.sex' | transloco }}</mat-label>
                <select matNativeControl data-testid="sex" formControlName="sex">
                  <option value="">{{ 'profile.sexUnset' | transloco }}</option>
                  <option value="male">{{ 'profile.sexMale' | transloco }}</option>
                  <option value="female">{{ 'profile.sexFemale' | transloco }}</option>
                  <option value="other">{{ 'profile.sexOther' | transloco }}</option>
                </select>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>{{ 'profile.weight' | transloco }}</mat-label>
                <input
                  matInput
                  type="number"
                  step="0.1"
                  inputmode="decimal"
                  data-testid="weight"
                  formControlName="weightKg"
                />
                @if (form.controls.weightKg.invalid) {
                  <mat-error>{{ 'profile.errors.positiveNumber' | transloco }}</mat-error>
                }
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>{{ 'profile.maxHr' | transloco }}</mat-label>
                <input
                  matInput
                  type="number"
                  step="1"
                  inputmode="numeric"
                  data-testid="max-hr"
                  formControlName="maxHr"
                />
                @if (form.controls.maxHr.invalid) {
                  <mat-error>{{ 'profile.errors.positiveInteger' | transloco }}</mat-error>
                }
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>{{ 'profile.restingHr' | transloco }}</mat-label>
                <input
                  matInput
                  type="number"
                  step="1"
                  inputmode="numeric"
                  data-testid="resting-hr"
                  formControlName="restingHr"
                />
                @if (form.controls.restingHr.invalid) {
                  <mat-error>{{ 'profile.errors.positiveInteger' | transloco }}</mat-error>
                }
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>{{ 'profile.ftp' | transloco }}</mat-label>
                <input
                  matInput
                  type="number"
                  step="1"
                  inputmode="numeric"
                  data-testid="ftp"
                  formControlName="ftpWatts"
                />
                @if (form.controls.ftpWatts.invalid) {
                  <mat-error>{{ 'profile.errors.positiveInteger' | transloco }}</mat-error>
                }
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>{{ 'profile.thresholdPace' | transloco }}</mat-label>
                <input
                  matInput
                  type="text"
                  autocomplete="off"
                  placeholder="4:30"
                  data-testid="pace"
                  formControlName="thresholdPace"
                />
                @if (form.controls.thresholdPace.invalid) {
                  <mat-error>{{ 'profile.errors.pace' | transloco }}</mat-error>
                } @else {
                  <mat-hint>{{ 'profile.thresholdPaceHint' | transloco }}</mat-hint>
                }
              </mat-form-field>
            </div>
          </section>
        }

        @if (saveError()) {
          <p class="error" role="alert" data-testid="save-error">{{ saveError()! | transloco }}</p>
        }
        @if (saved()) {
          <p role="status" data-testid="saved">{{ 'profile.saved' | transloco }}</p>
        }
        <button
          mat-flat-button
          type="submit"
          data-testid="save"
          [disabled]="!canSave() || saving()"
        >
          {{ (saving() ? 'profile.saving' : 'profile.save') | transloco }}
        </button>
      </form>

      <section class="danger">
        <button
          mat-stroked-button
          type="button"
          data-testid="delete-account"
          (click)="deleteAccount()"
        >
          {{ 'profile.delete.button' | transloco }}
        </button>
      </section>
    }
  `,
})
export class ProfilePage {
  private readonly userApi = inject(UserApi);
  private readonly auth = inject(AuthService);
  private readonly language = inject(LanguageService);
  private readonly transloco = inject(TranslocoService);
  private readonly dialog = inject(MatDialog);
  private readonly adapter = inject<DateAdapter<Date>>(DateAdapter);

  /** La data di nascita non può essere nel futuro né anteriore al 1900. */
  protected readonly minDate = MIN_DATE;
  protected readonly maxDate = inject(TODAY)();

  protected readonly me = signal<Me | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly saved = signal(false);

  protected readonly isAthlete = computed(() => this.auth.role() === 'athlete');

  private readonly timezones = signal<string[]>(timezoneOptions());

  protected readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email, Validators.maxLength(255)],
    }),
    // stesse regole del backend: 3-50 caratteri tra lettere ASCII, cifre, _ . -
    username: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^[A-Za-z0-9_.-]{3,50}$/)],
    }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.minLength(8)] }),
    currentPassword: new FormControl('', { nonNullable: true }),
    language: new FormControl('it', { nonNullable: true }),
    timezone: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        (c) => (this.timezones().includes(c.value) ? null : { timezone: true }),
      ],
    }),
    birthDate: new FormControl<Date | null>(null),
    sex: new FormControl('', { nonNullable: true }),
    weightKg: new FormControl<number | null>(null, [Validators.min(0.1)]),
    maxHr: new FormControl<number | null>(null, [Validators.min(1), integerValidator]),
    restingHr: new FormControl<number | null>(null, [Validators.min(1), integerValidator]),
    ftpWatts: new FormControl<number | null>(null, [Validators.min(1), integerValidator]),
    thresholdPace: new FormControl('', { nonNullable: true, validators: [paceValidator] }),
  });

  /** Contatore incrementato a ogni modifica del form: i segnali derivati si ricalcolano da qui. */
  private readonly formTick = signal(0);
  private readonly lang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });

  private readonly patch = computed<UpdateMeRequest>(() => {
    this.formTick();
    const me = this.me();
    return me === null ? {} : buildPatch(me, this.form.getRawValue(), this.isAthlete());
  });

  /** Per cambiare email o password il backend chiede la password attuale. */
  protected readonly needsCurrentPassword = computed(() => {
    const p = this.patch();
    return p.email !== undefined || p.password !== undefined;
  });

  protected readonly canSave = computed(() => {
    this.formTick();
    if (Object.keys(this.patch()).length === 0 || !this.form.valid) return false;
    return !this.needsCurrentPassword() || this.form.controls.currentPassword.value !== '';
  });

  protected readonly suggestions = computed(() => {
    this.formTick();
    const zones = this.timezones();
    const value = this.form.controls.timezone.value;
    // un valore già valido (es. quello salvato) non filtra: sul focus si vede l'elenco intero
    if (zones.includes(value)) return zones;
    const text = value.trim().toLowerCase();
    return zones.filter((z) => z.toLowerCase().includes(text)).slice(0, MAX_SUGGESTIONS);
  });

  constructor() {
    // il campo data segue la lingua attiva (formato e parsing gg/mm/aaaa in italiano)
    effect(() => this.adapter.setLocale(this.lang()));
    merge(this.form.valueChanges, this.form.statusChanges)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.formTick.update((n) => n + 1));
    // modificando il form spariscono l'esito e l'errore del salvataggio precedente
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.saved.set(false);
      this.saveError.set(null);
    });

    this.userApi
      .me()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (me) => this.load(me),
        error: (err: unknown) => this.loadError.set(errorKey(err)),
      });
  }

  protected save(): void {
    if (!this.canSave() || this.saving()) return;
    const patch = this.patch();
    this.saving.set(true);
    this.saveError.set(null);
    this.userApi.update(patch).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.load(updated);
        this.saved.set(true);
        if (patch.email !== undefined || patch.username !== undefined) {
          this.auth.updateUser({
            id: updated.id,
            email: updated.email,
            username: updated.username,
            role: updated.role,
          });
        }
        // la nuova lingua si applica subito all'interfaccia
        if (patch.language === 'it' || patch.language === 'en') {
          this.language.set(patch.language);
        }
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.saveError.set(errorKey(err));
      },
    });
  }

  protected deleteAccount(): void {
    this.dialog
      .open<DeleteAccountDialogComponent, void, boolean>(DeleteAccountDialogComponent)
      .afterClosed()
      .subscribe((deleted) => {
        // account eliminato: la sessione non vale più, il logout porta a /login
        if (deleted === true) this.auth.logout();
      });
  }

  /** Imposta il profilo caricato come nuovo riferimento e riallinea il form. */
  private load(me: Me): void {
    this.me.set(me);
    this.timezones.set(timezoneOptions(Intl, me.profile.timezone));
    this.form.reset(formValueFrom(me));
  }
}
