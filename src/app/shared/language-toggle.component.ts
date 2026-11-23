import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { TranslocoPipe } from '@jsverse/transloco';
import { Lang, LanguageService } from '../core/i18n/language.service';

/** Selettore IT/EN condiviso da shell e pagine di accesso. */
@Component({
  selector: 'app-language-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonToggleModule, TranslocoPipe],
  styles: `
    :host {
      display: inline-block;
    }
  `,
  template: `
    <mat-button-toggle-group
      hideSingleSelectionIndicator
      [value]="language.current()"
      [attr.aria-label]="'shell.language' | transloco"
      (change)="setLanguage($event.value)"
    >
      <mat-button-toggle value="it">IT</mat-button-toggle>
      <mat-button-toggle value="en">EN</mat-button-toggle>
    </mat-button-toggle-group>
  `,
})
export class LanguageToggleComponent {
  protected readonly language = inject(LanguageService);

  protected setLanguage(lang: Lang): void {
    this.language.set(lang);
  }
}
