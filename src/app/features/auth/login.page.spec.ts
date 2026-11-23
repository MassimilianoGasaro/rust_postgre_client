import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { LoginPage } from './login.page';
import { LanguageService } from '../../core/i18n/language.service';
import { translocoTesting } from '../../testing';
import itJson from '../../../../public/i18n/it.json';

function setup(queryParams: Record<string, string> = {}) {
  localStorage.clear();
  const language = { init: vi.fn(), set: vi.fn(), current: () => 'it' };
  TestBed.configureTestingModule({
    imports: [LoginPage, translocoTesting()],
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: LanguageService, useValue: language },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { queryParamMap: { get: (k: string) => queryParams[k] ?? null } } },
      },
    ],
  });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(LoginPage);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, el, navigate, language, ctrl: TestBed.inject(HttpTestingController) };
}

function fill(el: HTMLElement, selector: string, value: string) {
  const input = el.querySelector<HTMLInputElement>(selector)!;
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

function submit(ctx: ReturnType<typeof setup>, email = 'a@b.it', password = 'password1') {
  fill(ctx.el, 'input[type="email"]', email);
  fill(ctx.el, 'input[type="password"]', password);
  ctx.fixture.detectChanges();
  ctx.el.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
  ctx.fixture.detectChanges();
}

const user = (role: 'athlete' | 'coach') => ({ id: 1, email: 'a@b.it', username: 'abc', role });

describe('LoginPage', () => {
  it('lets a guest switch language without calling the API', () => {
    const ctx = setup();
    ctx.el.querySelector<HTMLButtonElement>('mat-button-toggle[value="en"] button')!.click();
    expect(ctx.language.set).toHaveBeenCalledWith('en');
    ctx.ctrl.expectNone(() => true);
  });

  it('shows the INVALID_CREDENTIALS message on a wrong login', () => {
    const ctx = setup();
    submit(ctx);
    ctx.ctrl
      .expectOne('/api/auth/login')
      .flush(
        { error: 'x', code: 'INVALID_CREDENTIALS', status: 401 },
        { status: 401, statusText: 'Unauthorized' },
      );
    ctx.fixture.detectChanges();
    expect(ctx.el.textContent).toContain(itJson.errors.INVALID_CREDENTIALS);
    expect(ctx.navigate).not.toHaveBeenCalled();
  });

  it('shows the generic message on an unknown error', () => {
    const ctx = setup();
    submit(ctx);
    ctx.ctrl.expectOne('/api/auth/login').flush('boom', { status: 500, statusText: 'err' });
    ctx.fixture.detectChanges();
    expect(ctx.el.textContent).toContain(itJson.errors.GENERIC);
  });

  it('navigates an athlete to /dashboard and refreshes the language', () => {
    const ctx = setup();
    submit(ctx);
    ctx.ctrl.expectOne('/api/auth/login').flush({ token: 't', user: user('athlete') });
    expect(ctx.navigate).toHaveBeenCalledWith('/dashboard');
    expect(ctx.language.init).toHaveBeenCalled();
  });

  it('navigates a coach to /coach/athletes', () => {
    const ctx = setup();
    submit(ctx);
    ctx.ctrl.expectOne('/api/auth/login').flush({ token: 't', user: user('coach') });
    expect(ctx.navigate).toHaveBeenCalledWith('/coach/athletes');
  });

  it('sends the typed credentials', () => {
    const ctx = setup();
    submit(ctx, 'x@y.it', 'secret-pass');
    const req = ctx.ctrl.expectOne('/api/auth/login');
    expect(req.request.body).toEqual({ email: 'x@y.it', password: 'secret-pass' });
  });

  it('disables submit while the form is empty', () => {
    const { el } = setup();
    expect(el.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
  });

  it('shows the session-expired message with ?expired=1', () => {
    const { el } = setup({ expired: '1' });
    expect(el.textContent).toContain(itJson.auth.sessionExpired);
  });

  it('does not show the session-expired message otherwise', () => {
    const { el } = setup();
    expect(el.textContent).not.toContain(itJson.auth.sessionExpired);
  });
});
