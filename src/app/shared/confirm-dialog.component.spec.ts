import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { translocoTesting } from '../testing';
import { ConfirmDialogComponent } from './confirm-dialog.component';

describe('ConfirmDialogComponent', () => {
  it('marks Cancel, not the destructive button, as the initial focus target', async () => {
    TestBed.configureTestingModule({ imports: [translocoTesting()] });
    const dialog = TestBed.inject(MatDialog);
    dialog.open(ConfirmDialogComponent, {
      data: { title: 'common.cancel', message: 'common.close', confirm: 'common.close' },
    });
    // jsdom non calcola il layout, quindi il focus reale non e' osservabile: si verifica
    // il marcatore `cdkFocusInitial` che il focus trap di CDK usa per il focus iniziale
    const initial = await vi.waitFor(() => {
      const found = document.querySelectorAll('mat-dialog-actions [cdkfocusinitial]');
      expect(found.length).toBe(1);
      return found[0];
    });
    expect(initial.getAttribute('data-testid')).toBe('confirm-cancel');
    dialog.closeAll();
  });
});
