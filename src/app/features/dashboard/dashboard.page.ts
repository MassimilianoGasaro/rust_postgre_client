import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { DashboardComponent } from './dashboard.component';

/** Pagina /dashboard dell'atleta: la dashboard sui propri dati. */
@Component({
  selector: 'app-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DashboardComponent, TranslocoPipe],
  styles: `
    h1 {
      max-width: 1100px;
      margin: 0 auto 16px;
      font: var(--mat-sys-headline-medium);
    }
  `,
  template: `
    <h1>{{ 'nav.dashboard' | transloco }}</h1>
    <app-dashboard />
  `,
})
export class DashboardPage {}
