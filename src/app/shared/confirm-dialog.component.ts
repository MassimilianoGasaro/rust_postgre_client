import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { TranslocoPipe } from '@jsverse/transloco';

/** Chiavi Transloco dei testi della conferma. */
export interface ConfirmDialogData {
  title: string;
  message: string;
  confirm: string;
}

/** Dialog di conferma: si chiude con `true` (conferma) o `false` (annulla). Il focus iniziale e' su Annulla (azione distruttiva). */
@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatButtonModule, TranslocoPipe],
  template: `
    <h2 mat-dialog-title>{{ data.title | transloco }}</h2>
    <mat-dialog-content>{{ data.message | transloco }}</mat-dialog-content>
    <mat-dialog-actions align="end">
      <button
        mat-button
        type="button"
        data-testid="confirm-cancel"
        cdkFocusInitial
        [mat-dialog-close]="false"
      >
        {{ 'common.cancel' | transloco }}
      </button>
      <button
        mat-flat-button
        type="button"
        data-testid="confirm-ok"
        [mat-dialog-close]="true"
      >
        {{ data.confirm | transloco }}
      </button>
    </mat-dialog-actions>
  `,
})
export class ConfirmDialogComponent {
  protected readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
}
