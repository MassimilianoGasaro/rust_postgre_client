import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { errorKey } from '../../core/api/errors';
import { UserApi } from '../../core/api/user-api';

/**
 * Conferma dell'eliminazione dell'account: chiede la password attuale ed esegue la DELETE.
 * Si chiude con `true` solo a eliminazione riuscita; un errore (es. password errata) resta nel dialog.
 */
@Component({
  selector: 'app-delete-account-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    TranslocoPipe,
  ],
  styles: `
    mat-form-field {
      width: 100%;
    }
    .error {
      margin: 0;
      color: var(--mat-sys-error);
    }
  `,
  template: `
    <h2 mat-dialog-title>{{ 'profile.delete.title' | transloco }}</h2>
    <mat-dialog-content>
      <p>{{ 'profile.delete.message' | transloco }}</p>
      <mat-form-field appearance="outline">
        <mat-label>{{ 'profile.delete.password' | transloco }}</mat-label>
        <input
          matInput
          type="password"
          autocomplete="current-password"
          data-testid="delete-password"
          [formControl]="password"
          (keydown.enter)="confirm()"
        />
      </mat-form-field>
      @if (error()) {
        <p class="error" role="alert" data-testid="delete-error">{{ error()! | transloco }}</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button
        mat-button
        type="button"
        data-testid="delete-cancel"
        [disabled]="busy()"
        [mat-dialog-close]="false"
      >
        {{ 'common.cancel' | transloco }}
      </button>
      <button
        mat-flat-button
        type="button"
        data-testid="delete-confirm"
        [disabled]="password.value === '' || busy()"
        (click)="confirm()"
      >
        {{ 'profile.delete.confirm' | transloco }}
      </button>
    </mat-dialog-actions>
  `,
})
export class DeleteAccountDialogComponent {
  private readonly userApi = inject(UserApi);
  private readonly ref = inject<MatDialogRef<DeleteAccountDialogComponent, boolean>>(MatDialogRef);

  protected readonly password = new FormControl('', { nonNullable: true });
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected confirm(): void {
    if (this.password.value === '' || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    // durante la richiesta il dialog non si può chiudere con Esc o clic fuori
    this.ref.disableClose = true;
    this.userApi.deleteMe(this.password.value).subscribe({
      next: () => this.ref.close(true),
      error: (err: unknown) => {
        this.busy.set(false);
        this.ref.disableClose = false;
        this.error.set(errorKey(err));
      },
    });
  }
}
