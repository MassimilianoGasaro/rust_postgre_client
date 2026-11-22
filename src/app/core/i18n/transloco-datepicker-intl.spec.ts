import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslocoService } from '@jsverse/transloco';
import { DATEPICKER_INTL_PROVIDER } from './transloco-datepicker-intl';
import { translocoTesting } from '../../testing';
import enJson from '../../../../public/i18n/en.json';
import itJson from '../../../../public/i18n/it.json';

@Component({
  imports: [MatDatepickerModule, MatFormFieldModule, MatInputModule],
  providers: [DATEPICKER_INTL_PROVIDER],
  template: `
    <mat-form-field>
      <input matInput [matDatepicker]="picker" />
      <mat-datepicker-toggle matIconSuffix [for]="picker" />
      <mat-datepicker #picker />
    </mat-form-field>
  `,
})
class HostComponent {}

describe('TranslocoDatepickerIntl', () => {
  function setup() {
    TestBed.configureTestingModule({
      imports: [HostComponent, translocoTesting()],
      providers: [provideNativeDateAdapter()],
    });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return fixture;
  }

  const toggleLabel = (el: HTMLElement) =>
    el.querySelector('mat-datepicker-toggle button')!.getAttribute('aria-label');

  it('labels the toggle with the active language and follows language changes', async () => {
    const fixture = setup();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(toggleLabel(fixture.nativeElement)).toBe(itJson.datepicker.open);
    });

    TestBed.inject(TranslocoService).setActiveLang('en');
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(toggleLabel(fixture.nativeElement)).toBe(enJson.datepicker.open);
    });
  });
});
