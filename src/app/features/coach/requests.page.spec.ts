import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { RequestsPage } from './requests.page';
import { CoachLink } from '../../core/api/models';
import { PendingRequestsService } from '../../core/coach/pending-requests.service';
import { translocoTesting } from '../../testing';
import itJson from '../../../../public/i18n/it.json';

const link = (id: number, username: string): CoachLink => ({
  id,
  athlete: { id: 100 + id, username },
  coach: { id: 9, username: 'coach_anna' },
  status: 'pending',
  requested_at: '2026-11-01T10:00:00Z',
  responded_at: null,
  ended_at: null,
});

const PENDING = '/api/coach-links?status=pending';

async function setup(links: CoachLink[] = [link(1, 'mario'), link(2, 'luca')]) {
  TestBed.configureTestingModule({
    imports: [RequestsPage, translocoTesting()],
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
  const ctrl = TestBed.inject(HttpTestingController);
  const pending = TestBed.inject(PendingRequestsService);
  const fixture = TestBed.createComponent(RequestsPage);
  fixture.detectChanges();
  ctrl.expectOne(PENDING).flush(links);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, ctrl, pending };
}

type Ctx = Awaited<ReturnType<typeof setup>>;

const q = <T extends HTMLElement = HTMLElement>(testId: string, root: ParentNode = document) =>
  root.querySelector<T>(`[data-testid="${testId}"]`);
const rows = (ctx: Ctx) => Array.from(ctx.el.querySelectorAll('[data-testid="request-row"]'));
const httpErr = (code: string, status: number) => ({
  body: { error: 'x', code, status },
  opts: { status, statusText: 'Err' },
});

describe('RequestsPage', () => {
  afterEach(() => {
    document.querySelectorAll('.cdk-overlay-container > *').forEach((n) => n.remove());
  });

  it('lists the pending requests with athlete and date and updates the badge count', async () => {
    const ctx = await setup();
    expect(rows(ctx).length).toBe(2);
    expect(rows(ctx)[0].textContent).toContain('mario');
    expect(rows(ctx)[0].textContent).toMatch(/2026/);
    expect(rows(ctx)[1].textContent).toContain('luca');
    expect(ctx.pending.count()).toBe(2);
  });

  it('shows the translated empty state', async () => {
    const ctx = await setup([]);
    expect(rows(ctx).length).toBe(0);
    expect(q('empty', ctx.el)!.textContent).toContain(itJson.coach.requests.empty);
    expect(ctx.pending.count()).toBe(0);
  });

  it('Accept calls /accept without confirmation, then reloads: the row disappears and the badge drops', async () => {
    const ctx = await setup();
    q<HTMLButtonElement>('accept', rows(ctx)[0] as HTMLElement)!.click();
    const req = ctx.ctrl.expectOne({ method: 'POST', url: '/api/coach-links/1/accept' });
    req.flush({ ...link(1, 'mario'), status: 'active' });
    ctx.ctrl.expectOne(PENDING).flush([link(2, 'luca')]);
    ctx.fixture.detectChanges();
    expect(rows(ctx).length).toBe(1);
    expect(rows(ctx)[0].textContent).toContain('luca');
    expect(ctx.pending.count()).toBe(1);
  });

  it('Reject asks for confirmation and calls /reject only when confirmed', async () => {
    const ctx = await setup();
    q<HTMLButtonElement>('reject', rows(ctx)[1] as HTMLElement)!.click();
    ctx.fixture.detectChanges();
    await ctx.fixture.whenStable();
    ctx.ctrl.expectNone('/api/coach-links/2/reject');
    q<HTMLButtonElement>('confirm-ok')!.click();
    ctx.fixture.detectChanges();
    await ctx.fixture.whenStable();
    const req = await vi.waitFor(() => ctx.ctrl.expectOne('/api/coach-links/2/reject'));
    expect(req.request.method).toBe('POST');
    req.flush({ ...link(2, 'luca'), status: 'rejected' });
    ctx.ctrl.expectOne(PENDING).flush([link(1, 'mario')]);
    ctx.fixture.detectChanges();
    expect(rows(ctx).length).toBe(1);
    expect(ctx.pending.count()).toBe(1);
  });

  it('cancelling the confirmation does not reject', async () => {
    const ctx = await setup();
    q<HTMLButtonElement>('reject', rows(ctx)[0] as HTMLElement)!.click();
    ctx.fixture.detectChanges();
    await ctx.fixture.whenStable();
    q<HTMLButtonElement>('confirm-cancel')!.click();
    ctx.fixture.detectChanges();
    await ctx.fixture.whenStable();
    ctx.ctrl.expectNone('/api/coach-links/1/reject');
    expect(rows(ctx).length).toBe(2);
  });

  it('on error shows the translated message and still reloads the list and the badge', async () => {
    const ctx = await setup();
    q<HTMLButtonElement>('accept', rows(ctx)[0] as HTMLElement)!.click();
    const e = httpErr('LINK_INVALID_STATE', 409);
    ctx.ctrl.expectOne('/api/coach-links/1/accept').flush(e.body, e.opts);
    // la richiesta è stata nel frattempo annullata dall'atleta: l'elenco si ricarica
    ctx.ctrl.expectOne(PENDING).flush([link(2, 'luca')]);
    ctx.fixture.detectChanges();
    expect(q('error', ctx.el)!.textContent).toContain(itJson.errors.LINK_INVALID_STATE);
    expect(rows(ctx).length).toBe(1);
    expect(ctx.pending.count()).toBe(1);
  });

  it('keeps the buttons disabled while an action and its reload are in progress', async () => {
    const ctx = await setup();
    q<HTMLButtonElement>('accept', rows(ctx)[0] as HTMLElement)!.click();
    ctx.fixture.detectChanges();
    expect(q<HTMLButtonElement>('accept', rows(ctx)[1] as HTMLElement)!.disabled).toBe(true);
    expect(q<HTMLButtonElement>('reject', rows(ctx)[1] as HTMLElement)!.disabled).toBe(true);
    ctx.ctrl.expectOne('/api/coach-links/1/accept').flush({});
    ctx.fixture.detectChanges();
    expect(q<HTMLButtonElement>('accept', rows(ctx)[1] as HTMLElement)!.disabled).toBe(true);
    ctx.ctrl.expectOne(PENDING).flush([link(2, 'luca')]);
    ctx.fixture.detectChanges();
    expect(q<HTMLButtonElement>('accept', rows(ctx)[0] as HTMLElement)!.disabled).toBe(false);
  });

  it('shows a translated error when the list cannot be loaded', async () => {
    TestBed.configureTestingModule({
      imports: [RequestsPage, translocoTesting()],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const ctrl = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(RequestsPage);
    fixture.detectChanges();
    const e = httpErr('INTERNAL', 500);
    ctrl.expectOne(PENDING).flush(e.body, e.opts);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(itJson.errors.INTERNAL);
  });
});
