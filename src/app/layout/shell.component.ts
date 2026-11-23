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
    @use '../../styles/glass' as glass;

    :host {
      display: block;
      height: 100dvh;
    }
    // il contenitore occupa tutta l'altezza: la toolbar flotta sopra il contenuto
    .shell-body {
      height: 100%;
      background: transparent;
      --mat-sidenav-content-background-color: transparent;
      --mat-sidenav-container-background-color: transparent;
      --mat-sidenav-container-elevation-shadow: none;
      --mat-sidenav-container-divider-color: transparent;
      --mat-sidenav-container-shape: 0;
    }
    // scroll edge effect: fascia sfocata che sfuma il contenuto sopra la toolbar flottante.
    // Niente mask sul contenitore che scorre: creerebbe un backdrop root e la toolbar
    // smetterebbe di sfocare il contenuto sottostante.
    .scroll-edge {
      position: sticky;
      top: 0;
      z-index: 1;
      height: 28px;
      margin-bottom: -28px;
      pointer-events: none;
      -webkit-backdrop-filter: blur(6px);
      backdrop-filter: blur(6px);
      -webkit-mask-image: linear-gradient(to bottom, #000 40%, transparent);
      mask-image: linear-gradient(to bottom, #000 40%, transparent);
    }
    mat-sidenav {
      width: 252px;
    }
    // pannello di vetro staccato dai bordi, come la sidebar flottante di iOS 26
    .nav-panel {
      @include glass.surface($radius: 24px);
      box-sizing: border-box;
      height: calc(100% - 24px);
      margin: 12px 0 12px 12px;
      padding: 8px 0;
      overflow-y: auto;
    }
    mat-nav-list {
      padding: 0 8px;
    }
    // toolbar: capsula di vetro che resta in alto mentre il contenuto scorre sotto
    .glass-bar {
      @include glass.surface($radius: 28px);
      position: sticky;
      top: 12px;
      z-index: 2;
      box-sizing: border-box;
      width: auto;
      margin: 12px 12px 0;
      padding: 0 8px;
      --mat-toolbar-container-background-color: transparent;
      --mat-toolbar-container-text-color: var(--mat-sys-on-surface);
    }
    .glass-bar .mat-mdc-icon-button {
      @include glass.interactive;
    }
    .spacer {
      flex: 1 1 auto;
    }
    .title {
      margin-left: 8px;
      font: var(--mat-sys-title-medium);
    }
    .content {
      box-sizing: border-box;
      padding: 16px;
    }
    .lang {
      margin-right: 8px;
      --mat-button-toggle-background-color: transparent;
      --mat-button-toggle-divider-color: var(--glass-rim);
      --mat-button-toggle-shape: 999px;
      --mat-button-toggle-height: 36px;
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
    <mat-sidenav-container class="shell-body">
      <mat-sidenav
        [mode]="handset() ? 'over' : 'side'"
        [opened]="drawerOpen()"
        (openedChange)="drawerOpen.set($event)"
      >
        <nav class="nav-panel">
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
        </nav>
      </mat-sidenav>
      <mat-sidenav-content>
        <div class="scroll-edge" aria-hidden="true"></div>
        <mat-toolbar class="glass-bar" data-testid="toolbar">
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
        <main class="content"><router-outlet /></main>
      </mat-sidenav-content>
    </mat-sidenav-container>
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
