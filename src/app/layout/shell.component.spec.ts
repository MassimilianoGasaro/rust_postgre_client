import { TestBed } from '@angular/core/testing';
import { BreakpointObserver } from '@angular/cdk/layout';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
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
      provideRouter([]),
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
  return { fixture, el: fixture.nativeElement as HTMLElement, logout, language };
}

const navTexts = (el: HTMLElement) =>
  Array.from(el.querySelectorAll('mat-sidenav [data-testid="nav-label"]')).map((s) =>
    s.textContent!.trim(),
  );

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
