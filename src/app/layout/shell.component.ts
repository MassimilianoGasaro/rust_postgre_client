import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { TranslocoPipe } from '@jsverse/transloco';
import { map } from 'rxjs';
import { Role } from '../core/api/models';
import { AuthService } from '../core/auth/auth.service';
import { Lang, LanguageService } from '../core/i18n/language.service';

interface NavItem {
  link: string;
  icon: string;
  /** Chiave Transloco dell'etichetta */
  label: string;
}

/** Voci del menu laterale per ruolo (il profilo sta nel menu utente). */
const NAV_ITEMS: Record<Role, NavItem[]> = {
  athlete: [
    { link: '/dashboard', icon: 'dashboard', label: 'nav.dashboard' },
    { link: '/import', icon: 'upload_file', label: 'nav.import' },
    { link: '/my-coach', icon: 'sports', label: 'nav.myCoach' },
  ],
  coach: [
    { link: '/coach/requests', icon: 'inbox', label: 'nav.requests' },
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
    MatButtonToggleModule,
    MatIconModule,
    MatListModule,
    MatMenuModule,
    MatSidenavModule,
    MatToolbarModule,
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
            [attr.aria-label]="'shell.menu' | transloco"
            (click)="drawerOpen.set(!drawerOpen())"
          >
            <mat-icon>menu</mat-icon>
          </button>
        }
        <span class="title">{{ 'app.title' | transloco }}</span>
        <span class="spacer"></span>

        <mat-button-toggle-group
          class="lang"
          hideSingleSelectionIndicator
          [value]="language.current()"
          [attr.aria-label]="'shell.language' | transloco"
          (change)="setLanguage($event.value)"
        >
          <mat-button-toggle value="it">IT</mat-button-toggle>
          <mat-button-toggle value="en">EN</mat-button-toggle>
        </mat-button-toggle-group>

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
  protected readonly language = inject(LanguageService);

  protected readonly handset = toSignal(
    inject(BreakpointObserver)
      .observe(Breakpoints.Handset)
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );

  /** Aperto su desktop, chiuso su mobile; si riallinea quando cambia il breakpoint. */
  protected readonly drawerOpen = linkedSignal(() => !this.handset());

  protected readonly navItems = computed(() => {
    const role = this.auth.role();
    return role ? NAV_ITEMS[role] : [];
  });

  protected setLanguage(lang: Lang): void {
    this.language.set(lang);
  }

  /** Su mobile il cassetto copre la pagina: si chiude dopo la navigazione. */
  protected onNavigate(): void {
    if (this.handset()) this.drawerOpen.set(false);
  }
}
