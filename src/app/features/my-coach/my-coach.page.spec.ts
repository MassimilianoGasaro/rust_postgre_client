import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MyCoachPage } from './my-coach.page';
import { CoachLink, CoachLinkStatus } from '../../core/api/models';
import { translocoTesting } from '../../testing';
import itJson from '../../../../public/i18n/it.json';

const link = (id: number, status: CoachLinkStatus, extra: Partial<CoachLink> = {}): CoachLink => ({
  id,
  athlete: { id: 1, username: 'mario' },
  coach: { id: 9, username: 'coach_anna' },
  status,
  requested_at: '2026-11-01T10:00:00Z',
  responded_at: null,
  ended_at: null,
  ...extra,
});

async function setup(links: CoachLink[] = []) {
  TestBed.configureTestingModule({
    imports: [MyCoachPage, translocoTesting()],
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
  const ctrl = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(MyCoachPage);
  fixture.detectChanges();
  const list = ctrl.expectOne({ method: 'GET', url: '/api/coach-links' });
  expect(list.request.params.keys()).toEqual([]);
  list.flush(links);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, ctrl };
}

type Ctx = Awaited<ReturnType<typeof setup>>;

const q = <T extends HTMLElement = HTMLElement>(testId: string, root: ParentNode = document) =>
  root.querySelector<T>(`[data-testid="${testId}"]`);

function typeCoach(ctx: Ctx, value: string) {
  const input = q<HTMLInputElement>('coach-input', ctx.el)!;
  input.value = value;
  input.dispatchEvent(new Event('input'));
  ctx.fixture.detectChanges();
}

function send(ctx: Ctx) {
  q<HTMLButtonElement>('send', ctx.el)!.click();
  ctx.fixture.detectChanges();
}

const httpErr = (code: string, status: number) => ({
  body: { error: 'x', code, status },
  opts: { status, statusText: 'Err' },
});

describe('MyCoachPage', () => {
  afterEach(() => {
    document.querySelectorAll('.cdk-overlay-container > *').forEach((n) => n.remove());
  });

  describe('no open link', () => {
    it('shows the request form and no link section', async () => {
      const ctx = await setup([link(1, 'rejected')]);
      expect(q('coach-input', ctx.el)).not.toBeNull();
      expect(q('pending', ctx.el)).toBeNull();
      expect(q('active', ctx.el)).toBeNull();
    });

    it('Send stays disabled while the field is empty', async () => {
      const ctx = await setup();
      expect(q<HTMLButtonElement>('send', ctx.el)!.disabled).toBe(true);
      typeCoach(ctx, '   ');
      expect(q<HTMLButtonElement>('send', ctx.el)!.disabled).toBe(true);
    });

    it('sends the request with the trimmed value, then shows the pending link', async () => {
      const ctx = await setup();
      typeCoach(ctx, '  anna@example.com ');
      send(ctx);
      const req = ctx.ctrl.expectOne({ method: 'POST', url: '/api/coach-links' });
      expect(req.request.body).toEqual({ coach: 'anna@example.com' });
      req.flush(link(5, 'pending'), { status: 201, statusText: 'Created' });
      ctx.ctrl.expectOne({ method: 'GET', url: '/api/coach-links' }).flush([link(5, 'pending')]);
      ctx.fixture.detectChanges();
      expect(q('pending', ctx.el)).not.toBeNull();
      expect(q('coach-input', ctx.el)).toBeNull();
    });

    it('COACH_NOT_FOUND shows the translated message and keeps the form', async () => {
      const ctx = await setup();
      typeCoach(ctx, 'nobody');
      send(ctx);
      const e = httpErr('COACH_NOT_FOUND', 404);
      ctx.ctrl.expectOne({ method: 'POST', url: '/api/coach-links' }).flush(e.body, e.opts);
      ctx.ctrl.expectOne({ method: 'GET', url: '/api/coach-links' }).flush([]);
      ctx.fixture.detectChanges();
      expect(q('error', ctx.el)!.textContent).toContain(itJson.errors.COACH_NOT_FOUND);
      expect(q<HTMLInputElement>('coach-input', ctx.el)!.value).toBe('nobody');
      expect(q<HTMLButtonElement>('send', ctx.el)!.disabled).toBe(false);
    });

    it.each(['NOT_A_COACH', 'COACH_LINK_EXISTS'])('translates %s', async (code) => {
      const ctx = await setup();
      typeCoach(ctx, 'someone');
      send(ctx);
      const e = httpErr(code, 409);
      ctx.ctrl.expectOne({ method: 'POST', url: '/api/coach-links' }).flush(e.body, e.opts);
      ctx.ctrl.expectOne({ method: 'GET', url: '/api/coach-links' }).flush([]);
      ctx.fixture.detectChanges();
      const text = q('error', ctx.el)!.textContent;
      expect(text).toContain((itJson.errors as Record<string, string>)[code]);
    });
  });

  describe('pending link', () => {
    it('shows the status and Cancel calls /cancel, then reloads', async () => {
      const ctx = await setup([link(5, 'pending')]);
      expect(q('pending', ctx.el)!.textContent).toContain('coach_anna');
      expect(q('coach-input', ctx.el)).toBeNull();
      q<HTMLButtonElement>('cancel-request', ctx.el)!.click();
      const req = ctx.ctrl.expectOne({ method: 'POST', url: '/api/coach-links/5/cancel' });
      req.flush(link(5, 'cancelled', { ended_at: '2026-11-02T10:00:00Z' }));
      ctx.ctrl
        .expectOne({ method: 'GET', url: '/api/coach-links' })
        .flush([link(5, 'cancelled', { ended_at: '2026-11-02T10:00:00Z' })]);
      ctx.fixture.detectChanges();
      expect(q('pending', ctx.el)).toBeNull();
      expect(q('coach-input', ctx.el)).not.toBeNull();
      expect(q('history', ctx.el)!.textContent).toContain(itJson.myCoach.status.cancelled);
    });

    it('shows a translated error when cancelling fails', async () => {
      const ctx = await setup([link(5, 'pending')]);
      q<HTMLButtonElement>('cancel-request', ctx.el)!.click();
      const e = httpErr('LINK_INVALID_STATE', 409);
      ctx.ctrl.expectOne('/api/coach-links/5/cancel').flush(e.body, e.opts);
      // lo stato mostrato è superato: l'elenco si ricarica anche dopo l'errore
      ctx.ctrl
        .expectOne({ method: 'GET', url: '/api/coach-links' })
        .flush([link(5, 'active', { responded_at: '2026-11-03T10:00:00Z' })]);
      ctx.fixture.detectChanges();
      expect(q('error', ctx.el)!.textContent).toContain(itJson.errors.LINK_INVALID_STATE);
      expect(q('pending', ctx.el)).toBeNull();
      expect(q('active', ctx.el)).not.toBeNull();
    });

    it('keeps the buttons disabled until the reload after an action completes', async () => {
      const ctx = await setup([link(5, 'pending')]);
      const cancel = q<HTMLButtonElement>('cancel-request', ctx.el)!;
      cancel.click();
      const e = httpErr('LINK_INVALID_STATE', 409);
      ctx.ctrl.expectOne('/api/coach-links/5/cancel').flush(e.body, e.opts);
      ctx.fixture.detectChanges();
      expect(cancel.disabled).toBe(true);
      ctx.ctrl.expectOne({ method: 'GET', url: '/api/coach-links' }).flush([link(5, 'pending')]);
      ctx.fixture.detectChanges();
      expect(q<HTMLButtonElement>('cancel-request', ctx.el)!.disabled).toBe(false);
    });
  });

  describe('active link', () => {
    const active = () => link(7, 'active', { responded_at: '2026-11-03T10:00:00Z' });

    const press = async (ctx: Ctx, testId: string) => {
      ctx.fixture.detectChanges();
      await ctx.fixture.whenStable();
      const button = q<HTMLButtonElement>(testId)!;
      expect(button, testId).not.toBeNull();
      button.click();
      ctx.fixture.detectChanges();
      await ctx.fixture.whenStable();
    };

    it('shows the coach name and Revoke', async () => {
      const ctx = await setup([active()]);
      expect(q('active', ctx.el)!.textContent).toContain('coach_anna');
      expect(q('revoke', ctx.el)).not.toBeNull();
      expect(q('cancel-request', ctx.el)).toBeNull();
    });

    it('Revoke calls /revoke only after confirmation', async () => {
      const ctx = await setup([active()]);
      q<HTMLButtonElement>('revoke', ctx.el)!.click();
      ctx.ctrl.expectNone('/api/coach-links/7/revoke');
      await press(ctx, 'confirm-ok');
      const req = await vi.waitFor(() => ctx.ctrl.expectOne('/api/coach-links/7/revoke'));
      expect(req.request.method).toBe('POST');
      const revoked = link(7, 'revoked', { ended_at: '2026-11-05T10:00:00Z' });
      req.flush(revoked);
      ctx.ctrl.expectOne({ method: 'GET', url: '/api/coach-links' }).flush([revoked]);
      ctx.fixture.detectChanges();
      expect(q('active', ctx.el)).toBeNull();
      expect(q('history', ctx.el)!.textContent).toContain(itJson.myCoach.status.revoked);
    });

    it('cancelling the confirmation does not revoke', async () => {
      const ctx = await setup([active()]);
      q<HTMLButtonElement>('revoke', ctx.el)!.click();
      await press(ctx, 'confirm-cancel');
      ctx.ctrl.expectNone('/api/coach-links/7/revoke');
      expect(q('active', ctx.el)).not.toBeNull();
    });
  });

  describe('history', () => {
    it('lists closed links, newest first, below the current one', async () => {
      const ctx = await setup([
        link(1, 'rejected', {
          coach: { id: 3, username: 'old_coach' },
          responded_at: '2026-01-05T10:00:00Z',
        }),
        link(2, 'revoked', {
          coach: { id: 4, username: 'newer_coach' },
          ended_at: '2026-06-05T10:00:00Z',
        }),
        link(3, 'pending'),
      ]);
      const rows = Array.from(ctx.el.querySelectorAll('[data-testid="history-item"]'));
      expect(rows.length).toBe(2);
      expect(rows[0].textContent).toContain('newer_coach');
      expect(rows[0].textContent).toContain(itJson.myCoach.status.revoked);
      expect(rows[1].textContent).toContain('old_coach');
      expect(rows[1].textContent).toContain(itJson.myCoach.status.rejected);
      // pending/active non finiscono nello storico
      expect(q('history', ctx.el)!.textContent).not.toContain('coach_anna');
    });

    it('is hidden when there are no closed links', async () => {
      const ctx = await setup([link(3, 'pending')]);
      expect(q('history', ctx.el)).toBeNull();
    });
  });

  it('shows a translated error when the list cannot be loaded', async () => {
    TestBed.configureTestingModule({
      imports: [MyCoachPage, translocoTesting()],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const ctrl = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(MyCoachPage);
    fixture.detectChanges();
    const e = httpErr('INTERNAL', 500);
    ctrl.expectOne('/api/coach-links').flush(e.body, e.opts);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(itJson.errors.INTERNAL);
  });
});
