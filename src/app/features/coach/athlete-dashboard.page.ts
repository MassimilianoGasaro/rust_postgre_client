import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

/** Segnaposto: la pagina vera sostituisce questo componente in un task successivo. */
@Component({
  selector: 'app-athlete-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  template: `<h1>{{ 'nav.athleteDashboard' | transloco }}</h1>`,
})
export class AthleteDashboardPage {}
