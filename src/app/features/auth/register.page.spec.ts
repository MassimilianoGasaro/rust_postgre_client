import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { RegisterPage } from './register.page';
import { LanguageService } from '../../core/i18n/language.service';
import { translocoTesting } from '../../testing';
import itJson from '../../../../public/i18n/it.json';

function setup() {
  localStorage.clear();
  const language = { init: vi.fn(), set: vi.fn(), current: () => 'en' };
  TestBed.configureTestingModule({
    imports: [RegisterPage, translocoTesting()],
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: LanguageService, useValue: language },
    ],
  });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(RegisterPage);
  fixture.detectChanges();
  return {
    fixture,
    el: fixture.nativeElement as HTMLElement,
    navigate,
    language,
    ctrl: TestBed.inject(HttpTestingController),
  };
}

function fill(el: HTMLElement, selector: string, value: string) {
  const input = el.querySelector<HTMLInputElement>(selector)!;
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

function fillAll(ctx: ReturnType<typeof setup>, password = 'password1') {
  fill(ctx.el, 'input[type="email"]', 'a@b.it');
  fill(ctx.el, 'input[formcontrolname="username"]', 'mario.rossi');
  fill(ctx.el, 'input[type="password"]', password);
  ctx.fixture.detectChanges();
}

function chooseCoach(ctx: ReturnType<typeof setup>) {
  ctx.el.querySelector<HTMLInputElement>('input[type="radio"][value="coach"]')!.click();
  ctx.fixture.detectChanges();
}

const submitBtn = (el: HTMLElement) =>
  el.querySelector<HTMLButtonElement>('button[type="submit"]')!;

describe('RegisterPage', () => {
  it('lets a guest switch language without calling the API', () => {
    const ctx = setup();
    ctx.el.querySelector<HTMLButtonElement>('mat-button-toggle[value="it"] button')!.click();
    expect(ctx.language.set).toHaveBeenCalledWith('it');
    ctx.ctrl.expectNone(() => true);
  });

  it('sends role "athlete" by default', () => {
    const ctx = setup();
    fillAll(ctx);
    submitBtn(ctx.el).click();
    const req = ctx.ctrl.expectOne('/api/auth/register');
    expect(req.request.body).toEqual({
      email: 'a@b.it',
      username: 'mario.rossi',
      password: 'password1',
      role: 'athlete',
    });
  });

  it('sends role "coach" when the coach radio is selected', () => {
    const ctx = setup();
    fillAll(ctx);
    chooseCoach(ctx);
    submitBtn(ctx.el).click();
    expect(ctx.ctrl.expectOne('/api/auth/register').request.body.role).toBe('coach');
  });

  it('disables submit when the password is shorter than 8 characters', () => {
    const ctx = setup();
    fillAll(ctx, 'short12');
    expect(submitBtn(ctx.el).disabled).toBe(true);
  });

  it('enables submit with a valid form', () => {
    const ctx = setup();
    fillAll(ctx, '12345678');
    expect(submitBtn(ctx.el).disabled).toBe(false);
  });

  it('disables submit for an invalid username', () => {
    const ctx = setup();
    fillAll(ctx);
    fill(ctx.el, 'input[formcontrolname="username"]', 'a b');
    ctx.fixture.detectChanges();
    expect(submitBtn(ctx.el).disabled).toBe(true);
  });

  it('navigates to the role home after success and keeps the chosen language on the profile', () => {
    const ctx = setup();
    fillAll(ctx);
    chooseCoach(ctx);
    submitBtn(ctx.el).click();
    ctx.ctrl.expectOne('/api/auth/register').flush({
      token: 't',
      user: { id: 2, email: 'a@b.it', username: 'mario.rossi', role: 'coach' },
    });
    expect(ctx.navigate).toHaveBeenCalledWith('/coach/athletes');
    expect(ctx.language.set).toHaveBeenCalledWith('en');
  });

  it('shows the translated EMAIL_TAKEN error', () => {
    const ctx = setup();
    fillAll(ctx);
    submitBtn(ctx.el).click();
    ctx.ctrl
      .expectOne('/api/auth/register')
      .flush(
        { error: 'x', code: 'EMAIL_TAKEN', status: 409 },
        { status: 409, statusText: 'Conflict' },
      );
    ctx.fixture.detectChanges();
    expect(ctx.el.textContent).toContain(itJson.errors.EMAIL_TAKEN);
    expect(ctx.navigate).not.toHaveBeenCalled();
  });
});
