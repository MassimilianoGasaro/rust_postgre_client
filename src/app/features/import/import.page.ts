import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

/** Segnaposto: la pagina vera sostituisce questo componente in un task successivo. */
@Component({
  selector: 'app-import-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  template: `<h1>{{ 'nav.import' | transloco }}</h1>`,
})
export class ImportPage {}
