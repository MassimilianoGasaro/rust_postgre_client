import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { LanguageService } from './language.service';
import { AuthService } from '../auth/auth.service';
import { translocoTesting } from '../../testing';

function setup(loggedIn: boolean) {
  TestBed.configureTestingModule({
    imports: [translocoTesting()],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: AuthService, useValue: { isLoggedIn: signal(loggedIn) } },
    ],
  });
  return {
    service: TestBed.inject(LanguageService),
    transloco: TestBed.inject(TranslocoService),
    ctrl: TestBed.inject(HttpTestingController),
  };
}

function setNavigatorLanguage(lang: string) {
  vi.spyOn(navigator, 'language', 'get').mockReturnValue(lang);
}

describe('LanguageService', () => {
  beforeEach(() => {
    localStorage.clear();
    setNavigatorLanguage('it-IT');
  });
  afterEach(() => vi.restoreAllMocks());

  it('init uses rp.lang when present, ahead of the navigator language', () => {
    localStorage.setItem('rp.lang', 'en');
    setNavigatorLanguage('it-IT');
    const { service, transloco } = setup(false);
    service.init();
    expect(transloco.getActiveLang()).toBe('en');
    expect(service.current()).toBe('en');
  });

  it('init falls back to the navigator language when it starts with "it"', () => {
    setNavigatorLanguage('it-CH');
    const { service, transloco } = setup(false);
    service.init();
    expect(transloco.getActiveLang()).toBe('it');
  });

  it('init picks English for a non-Italian navigator language', () => {
    setNavigatorLanguage('de-DE');
    const { service, transloco } = setup(false);
    service.init();
    expect(transloco.getActiveLang()).toBe('en');
  });

  it('init ignores an invalid rp.lang value', () => {
    localStorage.setItem('rp.lang', 'fr');
    setNavigatorLanguage('en-US');
    const { service, transloco } = setup(false);
    service.init();
    expect(transloco.getActiveLang()).toBe('en');
  });

  it('init does not call the API when logged out', () => {
    const { service, ctrl } = setup(false);
    service.init();
    ctrl.expectNone('/api/users/me');
  });

  it('init applies profile.language when logged in, ahead of rp.lang, and stores it', () => {
    localStorage.setItem('rp.lang', 'it');
    const { service, transloco, ctrl } = setup(true);
    service.init();
    ctrl.expectOne('/api/users/me').flush({ profile: { language: 'en' } });
    expect(transloco.getActiveLang()).toBe('en');
    expect(localStorage.getItem('rp.lang')).toBe('en');
    // applicare il profilo non deve rimandarlo al backend
    ctrl.expectNone((r) => r.method === 'PATCH');
  });

  it('init keeps the local language when the profile request fails', () => {
    localStorage.setItem('rp.lang', 'en');
    const { service, transloco, ctrl } = setup(true);
    service.init();
    ctrl.expectOne('/api/users/me').flush({}, { status: 500, statusText: 'err' });
    expect(transloco.getActiveLang()).toBe('en');
  });

  it('init ignores an unsupported profile language', () => {
    localStorage.setItem('rp.lang', 'en');
    const { service, transloco, ctrl } = setup(true);
    service.init();
    ctrl.expectOne('/api/users/me').flush({ profile: { language: 'xx' } });
    expect(transloco.getActiveLang()).toBe('en');
  });

  it('set("en") writes rp.lang, switches Transloco and PATCHes the profile when logged in', () => {
    const { service, transloco, ctrl } = setup(true);
    service.set('en');
    expect(transloco.getActiveLang()).toBe('en');
    expect(localStorage.getItem('rp.lang')).toBe('en');
    const req = ctrl.expectOne('/api/users/me');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ language: 'en' });
    req.flush({});
  });

  it('set does not call the API when logged out', () => {
    const { service, ctrl } = setup(false);
    service.set('en');
    expect(localStorage.getItem('rp.lang')).toBe('en');
    ctrl.expectNone('/api/users/me');
  });

  it('set survives a failing PATCH', () => {
    const { service, transloco, ctrl } = setup(true);
    service.set('en');
    ctrl.expectOne('/api/users/me').flush({}, { status: 500, statusText: 'err' });
    expect(transloco.getActiveLang()).toBe('en');
  });
});
