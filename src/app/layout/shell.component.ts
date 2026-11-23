import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { TranslocoPipe } from '@jsverse/transloco';
import { map } from 'rxjs';
import { Role } from '../core/api/models';
import { AuthService } from '../core/auth/auth.service';
import { PendingRequestsService } from '../core/coach/pending-requests.service';
import { LanguageToggleComponent } from '../shared/language-toggle.component';

interface NavItem {
  link: string;
  icon: string;
  /** Chiave Transloco dell'etichetta */
  label: string;
  /** Mostra il conteggio delle richieste in attesa accanto all'etichetta */
  pendingBadge?: boolean;
}

/** Voci del menu laterale per ruolo (il profilo sta nel menu utente). */
const NAV_ITEMS: Record<Role, NavItem[]> = {
  athlete: [
    { link: '/dashboard', icon: 'dashboard', label: 'nav.dashboard' },
    { link: '/import', icon: 'upload_file', label: 'nav.import' },
    { link: '/my-coach', icon: 'sports', label: 'nav.myCoach' },
  ],
  coach: [
    { link: '/coach/requests', icon: 'inbox', label: 'nav.requests', pendingBadge: true },
    { link: '/coach/athletes', icon: 'groups', label: 'nav.athletes' },
  ],
};

@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatMenuModule,
    MatSidenavModule,
    MatToolbarModule,
    LanguageToggleComponent,
    TranslocoPipe,
  ],
  styles: `
    :host {
      display: block;
      height: 100dvh;
    }
    .shell {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .shell-body {
      flex: 1;
      min-height: 0;
    }
    .spacer {
      flex: 1 1 auto;
    }
    .title {
      margin-left: 8px;
    }
    mat-sidenav {
      width: 240px;
    }
    .content {
      box-sizing: border-box;
      padding: 16px;
    }
    .lang {
      margin-right: 8px;
    }
    .dot {
      position: absolute;
      top: 10px;
      right: 10px;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--mat-sys-error);
    }
    .badge {
      min-width: 20px;
      padding: 0 6px;
      border-radius: 10px;
      background: var(--mat-sys-error);
      color: var(--mat-sys-on-error);
      font: var(--mat-sys-label-small);
      line-height: 20px;
      text-align: center;
    }
    .menu-user {
      padding: 8px 16px;
      font: var(--mat-sys-label-large);
    }
  `,
  template: `
    <div class="shell">
      <mat-toolbar color="primary">
        @if (handset()) {
          <button
            mat-icon-button
            type="button"
            data-testid="menu-toggle"
            [attr.aria-expanded]="drawerOpen()"
            [attr.aria-label]="menuLabel() | transloco: { count: pending.count() }"
            (click)="drawerOpen.set(!drawerOpen())"
          >
            <mat-icon>menu</mat-icon>
            @if (pending.count() > 0) {
              <span class="dot" data-testid="menu-badge" aria-hidden="true"></span>
            }
          </button>
        }
        <span class="title">{{ 'app.title' | transloco }}</span>
        <span class="spacer"></span>

        <app-language-toggle class="lang" />

        <button
          mat-icon-button
          type="button"
          data-testid="user-menu"
          [matMenuTriggerFor]="userMenu"
          [attr.aria-label]="'shell.userMenu' | transloco"
        >
          <mat-icon>account_circle</mat-icon>
        </button>
        <mat-menu #userMenu="matMenu">
          <div class="menu-user">{{ auth.user()?.username }}</div>
          <a mat-menu-item routerLink="/profile">
            <mat-icon>person</mat-icon>
            <span>{{ 'nav.profile' | transloco }}</span>
          </a>
          <button mat-menu-item type="button" data-testid="logout" (click)="auth.logout()">
            <mat-icon>logout</mat-icon>
            <span>{{ 'shell.logout' | transloco }}</span>
          </button>
        </mat-menu>
      </mat-toolbar>

      <mat-sidenav-container class="shell-body">
        <mat-sidenav
          [mode]="handset() ? 'over' : 'side'"
          [opened]="drawerOpen()"
          (openedChange)="drawerOpen.set($event)"
        >
          <mat-nav-list>
            @for (item of navItems(); track item.link) {
              <a
                mat-list-item
                [routerLink]="item.link"
                routerLinkActive
                #rla="routerLinkActive"
                [activated]="rla.isActive"
                (click)="onNavigate()"
              >
                <mat-icon matListItemIcon aria-hidden="true">{{ item.icon }}</mat-icon>
                <span matListItemTitle data-testid="nav-label">{{ item.label | transloco }}</span>
                @if (item.pendingBadge && pending.count() > 0) {
                  <span
                    matListItemMeta
                    class="badge"
                    role="img"
                    data-testid="requests-badge"
                    [attr.aria-label]="badgeLabel() | transloco: { count: pending.count() }"
                    >{{ pending.count() }}</span
                  >
                }
              </a>
            }
          </mat-nav-list>
        </mat-sidenav>
        <mat-sidenav-content>
          <div class="content"><router-outlet /></div>
        </mat-sidenav-content>
      </mat-sidenav-container>
    </div>
  `,
})
export class ShellComponent {
  protected readonly auth = inject(AuthService);
  protected readonly pending = inject(PendingRequestsService);

  protected readonly handset = toSignal(
    inject(BreakpointObserver)
      .observe(Breakpoints.Handset)
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );

  /** Aperto su desktop, chiuso su mobile; si riallinea quando cambia il breakpoint. */
  protected readonly drawerOpen = linkedSignal(() => !this.handset());

  /** Etichetta del pulsante menu: segnala anche le richieste in attesa. */
  protected readonly menuLabel = computed(() => {
    const count = this.pending.count();
    if (count === 0) return 'shell.menu';
    return count === 1 ? 'shell.menuPendingOne' : 'shell.menuPending';
  });

  /** Etichetta accessibile del badge: singolare con una sola richiesta. */
  protected readonly badgeLabel = computed(() =>
    this.pending.count() === 1 ? 'nav.pendingBadgeOne' : 'nav.pendingBadge',
  );

  protected readonly navItems = computed(() => {
    const role = this.auth.role();
    return role ? NAV_ITEMS[role] : [];
  });

  constructor() {
    // il conteggio serve solo al coach: si carica al login e si azzera negli altri casi
    effect(() => {
      const role = this.auth.role();
      untracked(() => (role === 'coach' ? this.pending.refresh() : this.pending.clear()));
    });
  }

  /** Su mobile il cassetto copre la pagina: si chiude dopo la navigazione. */
  protected onNavigate(): void {
    if (this.handset()) this.drawerOpen.set(false);
  }
}
