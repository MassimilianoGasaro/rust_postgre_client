import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DashboardComponent } from './dashboard.component';

/** Pagina /dashboard dell'atleta: la dashboard sui propri dati. */
@Component({
  selector: 'app-dashboard-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DashboardComponent],
  template: `<app-dashboard />`,
})
export class DashboardPage {}
