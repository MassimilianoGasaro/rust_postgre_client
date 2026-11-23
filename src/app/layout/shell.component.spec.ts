import { TestBed } from '@angular/core/testing';
import { BreakpointObserver } from '@angular/cdk/layout';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { ShellComponent } from './shell.component';
import { AuthService } from '../core/auth/auth.service';
import { LanguageService } from '../core/i18n/language.service';
import { Role } from '../core/api/models';
import { translocoTesting } from '../testing';
import itJson from '../../../public/i18n/it.json';

function setup(role: Role, handset: boolean) {
  const logout = vi.fn();
  const language = { init: vi.fn(), set: vi.fn(), current: signal<'it' | 'en'>('it') };
  TestBed.configureTestingModule({
    imports: [ShellComponent, translocoTesting()],
    providers: [
      provideRouter([{ path: '**', children: [] }]),
      provideHttpClient(),
      provideHttpClientTesting(),
      {
        provide: BreakpointObserver,
        useValue: { observe: () => of({ matches: handset, breakpoints: {} }) },
      },
      {
        provide: AuthService,
        useValue: {
          user: signal({ id: 1, email: 'a@b.it', username: 'mario', role }),
          role: signal(role),
          logout,
        },
      },
      { provide: LanguageService, useValue: language },
    ],
  });
  const fixture = TestBed.createComponent(ShellComponent);
  fixture.detectChanges();
  const ctrl = TestBed.inject(HttpTestingController);
  return { fixture, el: fixture.nativeElement as HTMLElement, logout, language, ctrl };
}

const navTexts = (el: HTMLElement) =>
  Array.from(el.querySelectorAll('mat-sidenav [data-testid="nav-label"]')).map((s) =>
    s.textContent!.trim(),
  );

const badge = (el: HTMLElement) => el.querySelector('[data-testid="requests-badge"]');

describe('ShellComponent', () => {
  it('uses side mode, opened, on desktop and has no hamburger', async () => {
    const { el, fixture } = setup('athlete', false);
    await fixture.whenStable();
    const drawer = el.querySelector('mat-sidenav')!;
    expect(drawer.classList.contains('mat-drawer-side')).toBe(true);
    expect(drawer.classList.contains('mat-drawer-opened')).toBe(true);
    expect(el.querySelector('button[data-testid="menu-toggle"]')).toBeNull();
  });

  it('uses over mode on a Handset viewport and shows the hamburger', () => {
    const { el } = setup('athlete', true);
    expect(el.querySelector('mat-sidenav')!.classList.contains('mat-drawer-over')).toBe(true);
    expect(el.querySelector('button[data-testid="menu-toggle"]')).not.toBeNull();
  });

  it('opens the over drawer from the hamburger', async () => {
    const { el, fixture } = setup('athlete', true);
    const drawer = el.querySelector('mat-sidenav')!;
    expect(drawer.classList.contains('mat-drawer-opened')).toBe(false);
    el.querySelector<HTMLButtonElement>('button[data-testid="menu-toggle"]')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(drawer.classList.contains('mat-drawer-opened')).toBe(true);
  });

  it('reflects the drawer state in aria-expanded on the hamburger', async () => {
    const { el, fixture } = setup('athlete', true);
    const toggle = el.querySelector<HTMLButtonElement>('button[data-testid="menu-toggle"]')!;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('closes the over drawer after clicking a nav link on Handset', async () => {
    const { el, fixture } = setup('athlete', true);
    const drawer = el.querySelector('mat-sidenav')!;
    el.querySelector<HTMLButtonElement>('button[data-testid="menu-toggle"]')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(drawer.classList.contains('mat-drawer-opened')).toBe(true);

    el.querySelector<HTMLAnchorElement>('mat-sidenav a[mat-list-item]')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(drawer.classList.contains('mat-drawer-opened')).toBe(false);
  });

  it('keeps the side drawer open after clicking a nav link on desktop', async () => {
    const { el, fixture } = setup('athlete', false);
    await fixture.whenStable();
    el.querySelector<HTMLAnchorElement>('mat-sidenav a[mat-list-item]')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el.querySelector('mat-sidenav')!.classList.contains('mat-drawer-opened')).toBe(true);
  });

  it('renders the routed content inside a single <main> landmark', () => {
    const { el } = setup('athlete', false);
    const mains = el.querySelectorAll('main');
    expect(mains.length).toBe(1);
    expect(mains[0].classList.contains('content')).toBe(true);
  });

  it('athlete menu contains Import and not Richieste', () => {
    const { el } = setup('athlete', false);
    const texts = navTexts(el);
    expect(texts).toContain(itJson.nav.import);
    expect(texts).toContain(itJson.nav.dashboard);
    expect(texts).toContain(itJson.nav.myCoach);
    expect(texts).not.toContain(itJson.nav.requests);
    expect(texts).not.toContain(itJson.nav.athletes);
  });

  it('coach menu contains Richieste and Atleti and not Import', () => {
    const { el } = setup('coach', false);
    const texts = navTexts(el);
    expect(texts).toContain(itJson.nav.requests);
    expect(texts).toContain(itJson.nav.athletes);
    expect(texts).not.toContain(itJson.nav.import);
  });

  describe('pending requests badge', () => {
    const PENDING = '/api/coach-links?status=pending';

    it('a coach sees the number of pending requests on the Requests item', async () => {
      const { el, fixture, ctrl } = setup('coach', false);
      ctrl.expectOne(PENDING).flush([{ id: 1 }, { id: 2 }, { id: 3 }]);
      fixture.detectChanges();
      expect(badge(el)!.textContent!.trim()).toBe('3');
      expect(badge(el)!.getAttribute('aria-label')).toBe('3 richieste in attesa');
      // il badge sta nella voce Richieste, non in quella degli atleti
      const items = Array.from(el.querySelectorAll('mat-sidenav a[mat-list-item]'));
      expect(items[0].contains(badge(el))).toBe(true);
      expect(el.querySelectorAll('[data-testid="requests-badge"]').length).toBe(1);
    });

    it('uses the singular form for a single pending request (badge and hamburger)', () => {
      const { el, fixture, ctrl } = setup('coach', true);
      ctrl.expectOne(PENDING).flush([{ id: 1 }]);
      fixture.detectChanges();
      expect(badge(el)!.getAttribute('aria-label')).toBe('1 richiesta in attesa');
      expect(
        el.querySelector('button[data-testid="menu-toggle"]')!.getAttribute('aria-label'),
      ).toBe('Apri il menu (1 richiesta in attesa)');
    });

    it('is hidden when there are no pending requests', async () => {
      const { el, fixture, ctrl } = setup('coach', false);
      ctrl.expectOne(PENDING).flush([]);
      fixture.detectChanges();
      expect(badge(el)).toBeNull();
    });

    it('is hidden while the count is not loaded yet', () => {
      const { el } = setup('coach', false);
      expect(badge(el)).toBeNull();
    });

    it('on Handset the hamburger shows a dot and a translated label while requests are pending', () => {
      const { el, fixture, ctrl } = setup('coach', true);
      const toggle = el.querySelector('button[data-testid="menu-toggle"]')!;
      expect(el.querySelector('[data-testid="menu-badge"]')).toBeNull();
      expect(toggle.getAttribute('aria-label')).toBe(itJson.shell.menu);
      ctrl.expectOne(PENDING).flush([{ id: 1 }, { id: 2 }]);
      fixture.detectChanges();
      expect(el.querySelector('[data-testid="menu-badge"]')).not.toBeNull();
      expect(toggle.getAttribute('aria-label')).toBe('Apri il menu (2 richieste in attesa)');
    });

    it('the hamburger has no dot without pending requests', () => {
      const { el, fixture, ctrl } = setup('coach', true);
      ctrl.expectOne(PENDING).flush([]);
      fixture.detectChanges();
      expect(el.querySelector('[data-testid="menu-badge"]')).toBeNull();
    });

    it('an athlete has no badge and no request is made', () => {
      const { el, ctrl } = setup('athlete', false);
      ctrl.expectNone(PENDING);
      expect(badge(el)).toBeNull();
    });
  });

  it('the language selector calls LanguageService.set', () => {
    const { el, fixture, language } = setup('athlete', false);
    el.querySelector<HTMLButtonElement>('mat-button-toggle[value="en"] button')!.click();
    fixture.detectChanges();
    expect(language.set).toHaveBeenCalledWith('en');
  });

  it('the user menu logs out', async () => {
    const { el, fixture, logout } = setup('athlete', false);
    el.querySelector<HTMLButtonElement>('button[data-testid="user-menu"]')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    document.querySelector<HTMLButtonElement>('button[data-testid="logout"]')!.click();
    expect(logout).toHaveBeenCalled();
  });
});
