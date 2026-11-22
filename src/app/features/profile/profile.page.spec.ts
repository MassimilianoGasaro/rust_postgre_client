import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TranslocoService } from '@jsverse/transloco';
import { ProfilePage } from './profile.page';
import { AuthService } from '../../core/auth/auth.service';
import { Me, Role } from '../../core/api/models';
import { translocoTesting } from '../../testing';
import enJson from '../../../../public/i18n/en.json';
import itJson from '../../../../public/i18n/it.json';

const me = (role: Role = 'athlete', profile: Partial<Me['profile']> = {}): Me => ({
  id: 1,
  email: 'a@b.it',
  username: 'mario',
  role,
  created_at: '2026-01-01T00:00:00Z',
  profile: {
    language: 'it',
    timezone: 'Europe/Rome',
    birth_date: '1990-03-15',
    sex: 'male',
    weight_kg: 70.5,
    max_hr: 190,
    resting_hr: 50,
    ftp_watts: 250,
    threshold_pace_s_per_km: 270,
    ...profile,
  },
});

async function setup(role: Role = 'athlete', profile: Partial<Me['profile']> = {}) {
  const auth = {
    role: signal<Role>(role),
    isLoggedIn: () => true,
    logout: vi.fn(),
    updateUser: vi.fn(),
  };
  TestBed.configureTestingModule({
    imports: [ProfilePage, translocoTesting()],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: AuthService, useValue: auth },
    ],
  });
  const ctrl = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(ProfilePage);
  fixture.detectChanges();
  const loaded = me(role, profile);
  ctrl.expectOne({ method: 'GET', url: '/api/users/me' }).flush(loaded);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, ctrl, auth, loaded };
}

type Ctx = Awaited<ReturnType<typeof setup>>;

const q = <T extends HTMLElement = HTMLElement>(testId: string, root: ParentNode = document) =>
  root.querySelector<T>(`[data-testid="${testId}"]`);

function type(ctx: Ctx, testId: string, value: string) {
  const input = q<HTMLInputElement>(testId, ctx.el)!;
  expect(input, testId).not.toBeNull();
  input.value = value;
  input.dispatchEvent(new Event('input'));
  ctx.fixture.detectChanges();
}

function choose(ctx: Ctx, testId: string, value: string) {
  const select = q<HTMLSelectElement>(testId, ctx.el)!;
  select.value = value;
  select.dispatchEvent(new Event('change'));
  ctx.fixture.detectChanges();
}

/** Il messaggio d'errore di Material compare solo dopo che il campo è stato toccato. */
function touch(ctx: Ctx, testId: string) {
  q<HTMLInputElement>(testId, ctx.el)!.dispatchEvent(new Event('blur'));
  ctx.fixture.detectChanges();
}

const save = (ctx: Ctx) => q<HTMLButtonElement>('save', ctx.el)!;

function submit(ctx: Ctx) {
  save(ctx).click();
  ctx.fixture.detectChanges();
}

const patchReq = (ctx: Ctx) => ctx.ctrl.expectOne({ method: 'PATCH', url: '/api/users/me' });

describe('ProfilePage', () => {
  afterEach(() => {
    document.querySelectorAll('.cdk-overlay-container > *').forEach((n) => n.remove());
  });

  it('loads the profile into the form', async () => {
    const ctx = await setup();
    expect(q<HTMLInputElement>('email', ctx.el)!.value).toBe('a@b.it');
    expect(q<HTMLInputElement>('username', ctx.el)!.value).toBe('mario');
    expect(q<HTMLSelectElement>('language', ctx.el)!.value).toBe('it');
    expect(q<HTMLInputElement>('timezone', ctx.el)!.value).toBe('Europe/Rome');
    expect(q<HTMLInputElement>('birth-date', ctx.el)!.value).toContain('1990');
    expect(q<HTMLSelectElement>('sex', ctx.el)!.value).toBe('male');
    expect(q<HTMLInputElement>('weight', ctx.el)!.value).toBe('70.5');
    expect(q<HTMLInputElement>('pace', ctx.el)!.value).toBe('4:30');
  });

  it('shows a load error when the profile cannot be read', async () => {
    TestBed.configureTestingModule({
      imports: [ProfilePage, translocoTesting()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { role: signal<Role>('athlete') } },
      ],
    });
    const ctrl = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ProfilePage);
    fixture.detectChanges();
    ctrl
      .expectOne('/api/users/me')
      .flush({ error: 'x', code: 'INTERNAL', status: 500 }, { status: 500, statusText: 'Err' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(itJson.errors.INTERNAL);
  });

  it('the birth date calendar toggle is labelled in the active language', async () => {
    const ctx = await setup();
    const label = () =>
      ctx.el.querySelector('mat-datepicker-toggle button')!.getAttribute('aria-label');
    await vi.waitFor(() => {
      ctx.fixture.detectChanges();
      expect(label()).toBe(itJson.datepicker.open);
    });
    TestBed.inject(TranslocoService).setActiveLang('en');
    await vi.waitFor(() => {
      ctx.fixture.detectChanges();
      expect(label()).toBe(enJson.datepicker.open);
    });
  });

  it('keeps Save disabled while nothing changed', async () => {
    const ctx = await setup();
    expect(save(ctx).disabled).toBe(true);
  });

  it('save sends only the changed fields', async () => {
    const ctx = await setup();
    type(ctx, 'username', 'luigi');
    type(ctx, 'max-hr', '185');
    submit(ctx);
    expect(patchReq(ctx).request.body).toEqual({ username: 'luigi', max_hr: 185 });
  });

  it('clearing the weight sends weight_kg: null', async () => {
    const ctx = await setup();
    type(ctx, 'weight', '');
    submit(ctx);
    expect(patchReq(ctx).request.body).toEqual({ weight_kg: null });
  });

  it('pace 4:30 is sent as threshold_pace_s_per_km: 270', async () => {
    const ctx = await setup('athlete', { threshold_pace_s_per_km: null });
    type(ctx, 'pace', '4:30');
    submit(ctx);
    expect(patchReq(ctx).request.body).toEqual({ threshold_pace_s_per_km: 270 });
  });

  it('an invalid pace disables Save and shows an error', async () => {
    const ctx = await setup();
    type(ctx, 'pace', '4:75');
    touch(ctx, 'pace');
    expect(save(ctx).disabled).toBe(true);
    expect(ctx.el.textContent).toContain(itJson.profile.errors.pace);
  });

  it('weight is sent with one decimal', async () => {
    const ctx = await setup();
    type(ctx, 'weight', '71.26');
    submit(ctx);
    expect(patchReq(ctx).request.body).toEqual({ weight_kg: 71.3 });
  });

  it('a typed birth date dd/mm/yyyy is sent as YYYY-MM-DD', async () => {
    const ctx = await setup();
    type(ctx, 'birth-date', '02/01/1991');
    submit(ctx);
    expect(patchReq(ctx).request.body).toEqual({ birth_date: '1991-01-02' });
  });

  it('coaches do not see the physiological fields', async () => {
    const ctx = await setup('coach');
    for (const id of ['birth-date', 'sex', 'weight', 'max-hr', 'resting-hr', 'ftp', 'pace']) {
      expect(q(id, ctx.el), id).toBeNull();
    }
    expect(q('email', ctx.el)).not.toBeNull();
    expect(q('timezone', ctx.el)).not.toBeNull();
  });

  describe('timezone', () => {
    it('a value outside the list disables Save and shows an error', async () => {
      const ctx = await setup();
      type(ctx, 'timezone', 'Mars/Olympus');
      touch(ctx, 'timezone');
      expect(save(ctx).disabled).toBe(true);
      expect(ctx.el.textContent).toContain(itJson.profile.errors.timezone);
    });

    it('on focus with a valid stored zone the whole list is offered, not only that zone', async () => {
      const ctx = await setup();
      q<HTMLInputElement>('timezone', ctx.el)!.dispatchEvent(new Event('focusin'));
      ctx.fixture.detectChanges();
      await ctx.fixture.whenStable();
      const options = Array.from(document.querySelectorAll('mat-option')).map((o) =>
        o.textContent!.trim(),
      );
      expect(options).toContain('Europe/Rome');
      expect(options).toContain('Asia/Tokyo');
    });

    it('typing narrows the offered zones', async () => {
      const ctx = await setup();
      const input = q<HTMLInputElement>('timezone', ctx.el)!;
      input.dispatchEvent(new Event('focusin'));
      type(ctx, 'timezone', 'tokyo');
      await ctx.fixture.whenStable();
      ctx.fixture.detectChanges();
      const options = Array.from(document.querySelectorAll('mat-option')).map((o) =>
        o.textContent!.trim(),
      );
      expect(options).toEqual(['Asia/Tokyo']);
    });

    it('a valid zone is sent', async () => {
      const ctx = await setup();
      type(ctx, 'timezone', 'Asia/Tokyo');
      submit(ctx);
      expect(patchReq(ctx).request.body).toEqual({ timezone: 'Asia/Tokyo' });
    });
  });

  describe('current password', () => {
    it('is hidden until email or new password change', async () => {
      const ctx = await setup();
      expect(q('current-password', ctx.el)).toBeNull();
      type(ctx, 'email', 'new@b.it');
      expect(q('current-password', ctx.el)).not.toBeNull();
      type(ctx, 'email', 'a@b.it');
      expect(q('current-password', ctx.el)).toBeNull();
      type(ctx, 'password', 'newpassword');
      expect(q('current-password', ctx.el)).not.toBeNull();
    });

    it('Save stays disabled until it is filled, then sends current_password', async () => {
      const ctx = await setup();
      type(ctx, 'email', 'new@b.it');
      expect(save(ctx).disabled).toBe(true);
      type(ctx, 'current-password', 'oldpass');
      expect(save(ctx).disabled).toBe(false);
      submit(ctx);
      expect(patchReq(ctx).request.body).toEqual({
        email: 'new@b.it',
        current_password: 'oldpass',
      });
    });

    it('a new password shorter than 8 characters disables Save', async () => {
      const ctx = await setup();
      type(ctx, 'password', 'short');
      type(ctx, 'current-password', 'oldpass');
      expect(save(ctx).disabled).toBe(true);
      type(ctx, 'password', 'longenough');
      expect(save(ctx).disabled).toBe(false);
    });

    it('a wrong current password shows INVALID_CREDENTIALS inline and keeps the form', async () => {
      const ctx = await setup();
      type(ctx, 'password', 'newpassword');
      type(ctx, 'current-password', 'wrong');
      submit(ctx);
      patchReq(ctx).flush(
        { error: 'x', code: 'INVALID_CREDENTIALS', status: 401 },
        { status: 401, statusText: 'Unauthorized' },
      );
      ctx.fixture.detectChanges();
      expect(q('save-error', ctx.el)!.textContent).toContain(itJson.errors.INVALID_CREDENTIALS);
      expect(q<HTMLInputElement>('password', ctx.el)!.value).toBe('newpassword');
      expect(ctx.auth.logout).not.toHaveBeenCalled();
    });

    it('after a successful save the password fields are cleared and the baseline updated', async () => {
      const ctx = await setup();
      type(ctx, 'email', 'new@b.it');
      type(ctx, 'password', 'newpassword');
      type(ctx, 'current-password', 'oldpass');
      submit(ctx);
      patchReq(ctx).flush({ ...ctx.loaded, email: 'new@b.it' });
      ctx.fixture.detectChanges();
      expect(q('current-password', ctx.el)).toBeNull();
      expect(q<HTMLInputElement>('password', ctx.el)!.value).toBe('');
      expect(q<HTMLInputElement>('email', ctx.el)!.value).toBe('new@b.it');
      expect(save(ctx).disabled).toBe(true);
      expect(q('saved', ctx.el)).not.toBeNull();
    });
  });

  describe('save outcome', () => {
    it('updates the session user when email or username changed', async () => {
      const ctx = await setup();
      type(ctx, 'username', 'luigi');
      submit(ctx);
      patchReq(ctx).flush({ ...ctx.loaded, username: 'luigi' });
      expect(ctx.auth.updateUser).toHaveBeenCalledWith({
        id: 1,
        email: 'a@b.it',
        username: 'luigi',
        role: 'athlete',
      });
    });

    it('translates backend errors inline', async () => {
      const ctx = await setup();
      type(ctx, 'username', 'luigi');
      submit(ctx);
      patchReq(ctx).flush(
        { error: 'x', code: 'USERNAME_TAKEN', status: 409 },
        { status: 409, statusText: 'Conflict' },
      );
      ctx.fixture.detectChanges();
      expect(q('save-error', ctx.el)!.textContent).toContain(itJson.errors.USERNAME_TAKEN);
      expect(save(ctx).disabled).toBe(false);
    });
  });

  it('changing the language sends it and applies the translation immediately', async () => {
    const ctx = await setup();
    const transloco = TestBed.inject(TranslocoService);
    choose(ctx, 'language', 'en');
    submit(ctx);
    patchReq(ctx).flush({ ...ctx.loaded, profile: { ...ctx.loaded.profile, language: 'en' } });
    expect(transloco.getActiveLang()).toBe('en');
    // LanguageService.set() salva anche lei la lingua nel profilo
    ctx.ctrl.expectOne({ method: 'PATCH', url: '/api/users/me' }).flush(ctx.loaded);
  });

  it('does not touch the language when it was not changed', async () => {
    const ctx = await setup();
    const transloco = TestBed.inject(TranslocoService);
    type(ctx, 'username', 'luigi');
    submit(ctx);
    expect(patchReq(ctx).request.body).toEqual({ username: 'luigi' });
    expect(transloco.getActiveLang()).toBe('it');
  });

  describe('delete account', () => {
    const press = async (ctx: Ctx, testId: string) => {
      ctx.fixture.detectChanges();
      await ctx.fixture.whenStable();
      const button = q<HTMLButtonElement>(testId)!;
      expect(button, testId).not.toBeNull();
      button.click();
      ctx.fixture.detectChanges();
      await ctx.fixture.whenStable();
    };

    const typeInDialog = async (ctx: Ctx, value: string) => {
      ctx.fixture.detectChanges();
      await ctx.fixture.whenStable();
      const input = q<HTMLInputElement>('delete-password')!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
      ctx.fixture.detectChanges();
    };

    it('asks for the password in a dialog; the confirm button needs it', async () => {
      const ctx = await setup();
      q<HTMLButtonElement>('delete-account', ctx.el)!.click();
      await typeInDialog(ctx, '');
      expect(q<HTMLButtonElement>('delete-confirm')!.disabled).toBe(true);
      await typeInDialog(ctx, 'secret');
      expect(q<HTMLButtonElement>('delete-confirm')!.disabled).toBe(false);
    });

    it('cancelling does not delete', async () => {
      const ctx = await setup();
      q<HTMLButtonElement>('delete-account', ctx.el)!.click();
      await press(ctx, 'delete-cancel');
      ctx.ctrl.expectNone({ method: 'DELETE', url: '/api/users/me' });
      expect(ctx.auth.logout).not.toHaveBeenCalled();
    });

    it('confirming sends the password, then logs out on 204', async () => {
      const ctx = await setup();
      q<HTMLButtonElement>('delete-account', ctx.el)!.click();
      await typeInDialog(ctx, 'secret');
      await press(ctx, 'delete-confirm');
      const del = await vi.waitFor(() =>
        ctx.ctrl.expectOne({ method: 'DELETE', url: '/api/users/me' }),
      );
      expect(del.request.body).toEqual({ current_password: 'secret' });
      del.flush(null, { status: 204, statusText: 'No Content' });
      ctx.fixture.detectChanges();
      await vi.waitFor(() => expect(ctx.auth.logout).toHaveBeenCalledTimes(1));
      expect(document.querySelector('app-delete-account-dialog')).toBeNull();
    });

    it('a wrong password shows the error in the dialog and keeps it open', async () => {
      const ctx = await setup();
      q<HTMLButtonElement>('delete-account', ctx.el)!.click();
      await typeInDialog(ctx, 'wrong');
      await press(ctx, 'delete-confirm');
      const del = await vi.waitFor(() =>
        ctx.ctrl.expectOne({ method: 'DELETE', url: '/api/users/me' }),
      );
      del.flush(
        { error: 'x', code: 'INVALID_CREDENTIALS', status: 401 },
        { status: 401, statusText: 'Unauthorized' },
      );
      ctx.fixture.detectChanges();
      await ctx.fixture.whenStable();
      const dialog = document.querySelector('app-delete-account-dialog');
      expect(dialog).not.toBeNull();
      expect(q('delete-error')!.textContent).toContain(itJson.errors.INVALID_CREDENTIALS);
      expect(ctx.auth.logout).not.toHaveBeenCalled();
    });
  });
});
