import { TestBed } from '@angular/core/testing';
import { HttpEventType } from '@angular/common/http';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BreakpointObserver } from '@angular/cdk/layout';
import { of } from 'rxjs';
import { ImportPage } from './import.page';
import { ImportDto } from '../../core/api/models';
import { translocoTesting } from '../../testing';
import itJson from '../../../../public/i18n/it.json';

const imp = (id: number, status: ImportDto['status'], items?: ImportDto['items']): ImportDto => ({
  id,
  status,
  created_at: '2026-11-20T10:00:00Z',
  finished_at: status === 'processing' ? null : '2026-11-20T10:00:05Z',
  ...(items ? { items } : {}),
});

interface SetupOptions {
  handset?: boolean;
  /** Risposta di GET /api/imports al caricamento */
  recent?: ImportDto[];
}

function setup(options: SetupOptions = {}) {
  TestBed.configureTestingModule({
    imports: [ImportPage, translocoTesting()],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      {
        provide: BreakpointObserver,
        useValue: { observe: () => of({ matches: options.handset ?? false, breakpoints: {} }) },
      },
    ],
  });
  const ctrl = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(ImportPage);
  fixture.detectChanges();
  ctrl.expectOne({ method: 'GET', url: '/api/imports' }).flush(options.recent ?? []);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, el, ctrl };
}

type Ctx = ReturnType<typeof setup>;

const q = <T extends HTMLElement>(el: HTMLElement, testId: string) =>
  el.querySelector<T>(`[data-testid="${testId}"]`);

function file(name: string, size = 10): File {
  return new File([new Uint8Array(size)], name);
}

/** Simula la scelta dei file dal selettore nativo. */
function choose(ctx: Ctx, files: File[]) {
  const input = q<HTMLInputElement>(ctx.el, 'file-input')!;
  Object.defineProperty(input, 'files', { value: files, configurable: true });
  input.dispatchEvent(new Event('change'));
  ctx.fixture.detectChanges();
}

function clickUpload(ctx: Ctx) {
  q<HTMLButtonElement>(ctx.el, 'upload')!.click();
  ctx.fixture.detectChanges();
}

const postReq = (ctx: Ctx) => ctx.ctrl.expectOne({ method: 'POST', url: '/api/imports' });

describe('ImportPage', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('configures the file input for multiple FIT/GPX/TCX/ZIP files', () => {
    const { el } = setup();
    const input = q<HTMLInputElement>(el, 'file-input')!;
    expect(input.type).toBe('file');
    expect(input.multiple).toBe(true);
    expect(input.accept).toBe('.fit,.gpx,.tcx,.zip');
  });

  it('shows recent imports with their translated status on load', () => {
    const { el } = setup({ recent: [imp(2, 'completed'), imp(1, 'failed')] });
    const recent = q(el, 'recent')!;
    expect(recent.textContent).toContain(itJson.import.status.completed);
    expect(recent.textContent).toContain(itJson.import.status.failed);
    expect(recent.querySelectorAll('[data-testid="recent-row"]').length).toBe(2);
  });

  it('shows an empty message when there are no recent imports', () => {
    const { el } = setup();
    expect(q(el, 'recent')!.textContent).toContain(itJson.import.recentEmpty);
  });

  it('lists the chosen files with their size and disables upload when empty', () => {
    const ctx = setup();
    expect(q<HTMLButtonElement>(ctx.el, 'upload')!.disabled).toBe(true);
    choose(ctx, [file('a.fit', 2048), file('b.gpx')]);
    const list = q(ctx.el, 'selected')!;
    expect(list.textContent).toContain('a.fit');
    expect(list.textContent).toContain('2');
    expect(list.textContent).toContain('KB');
    expect(list.textContent).toContain('b.gpx');
    expect(q<HTMLButtonElement>(ctx.el, 'upload')!.disabled).toBe(false);
  });

  it('removes a chosen file from the list', () => {
    const ctx = setup();
    choose(ctx, [file('a.fit'), file('b.gpx')]);
    q<HTMLButtonElement>(ctx.el, 'remove-0')!.click();
    ctx.fixture.detectChanges();
    expect(q(ctx.el, 'selected')!.textContent).not.toContain('a.fit');
    expect(q(ctx.el, 'selected')!.textContent).toContain('b.gpx');
  });

  it('skips files with an unsupported extension and does not upload them', () => {
    const ctx = setup();
    choose(ctx, [file('a.FIT'), file('notes.txt'), file('photo.jpg')]);
    expect(q(ctx.el, 'selected')!.textContent).toContain('a.FIT');
    expect(q(ctx.el, 'skipped')!.textContent).toContain('notes.txt');
    expect(q(ctx.el, 'skipped')!.textContent).toContain('photo.jpg');
    clickUpload(ctx);
    const body = postReq(ctx).request.body as FormData;
    expect(body.getAll('files').map((f) => (f as File).name)).toEqual(['a.FIT']);
  });

  it('accepts files dropped on the drop zone', () => {
    const ctx = setup();
    const zone = q(ctx.el, 'drop-zone')!;
    const over = new Event('dragover', { cancelable: true });
    zone.dispatchEvent(over);
    expect(over.defaultPrevented).toBe(true);
    const drop = new Event('drop', { cancelable: true });
    Object.defineProperty(drop, 'dataTransfer', { value: { files: [file('d.tcx')] } });
    zone.dispatchEvent(drop);
    ctx.fixture.detectChanges();
    expect(drop.defaultPrevented).toBe(true);
    expect(q(ctx.el, 'selected')!.textContent).toContain('d.tcx');
  });

  it('sends a single multipart POST with all chosen files', () => {
    const ctx = setup();
    choose(ctx, [file('a.fit'), file('b.gpx')]);
    clickUpload(ctx);
    const req = postReq(ctx);
    expect(req.request.body).toBeInstanceOf(FormData);
    expect((req.request.body as FormData).getAll('files').length).toBe(2);
  });

  it('updates the progress bar from upload progress events', () => {
    const ctx = setup();
    choose(ctx, [file('a.fit')]);
    clickUpload(ctx);
    const req = postReq(ctx);
    req.event({ type: HttpEventType.UploadProgress, loaded: 40, total: 100 });
    ctx.fixture.detectChanges();
    expect(q(ctx.el, 'progress')!.getAttribute('aria-valuenow')).toBe('40');
    req.event({ type: HttpEventType.UploadProgress, loaded: 100, total: 100 });
    ctx.fixture.detectChanges();
    expect(q(ctx.el, 'progress')!.getAttribute('aria-valuenow')).toBe('100');
  });

  it('polls GET /api/imports/:id every second until completed and shows per-file results', () => {
    const ctx = setup();
    choose(ctx, [file('a.fit'), file('b.gpx')]);
    clickUpload(ctx);
    postReq(ctx).flush(imp(7, 'processing', []), { status: 202, statusText: 'Accepted' });

    // primo giro subito (timer(0)), ancora in elaborazione
    vi.advanceTimersByTime(0);
    ctx.ctrl.expectOne('/api/imports/7').flush(imp(7, 'processing', []));
    ctx.fixture.detectChanges();
    expect(q(ctx.el, 'summary')).toBeNull();

    // un secondo dopo, completato
    vi.advanceTimersByTime(1000);
    ctx.ctrl.expectOne('/api/imports/7').flush(
      imp(7, 'completed', [
        { filename: 'a.fit', status: 'imported', activity_id: 3, error_code: null },
        { filename: 'b.gpx', status: 'failed', activity_id: null, error_code: 'PARSE_ERROR' },
      ]),
    );
    ctx.fixture.detectChanges();

    const results = q(ctx.el, 'results')!;
    expect(results.textContent).toContain('a.fit');
    expect(results.textContent).toContain(itJson.import.status.imported);
    expect(results.textContent).toContain(itJson.import.status.failed);
    expect(results.textContent).toContain(itJson.errors.PARSE_ERROR);
    expect(q(ctx.el, 'summary')!.textContent).toContain('1 importata, 0 duplicate, 1 errore');

    // polling concluso: nessun'altra GET, ma la lista dei recenti viene aggiornata
    ctx.ctrl.expectOne({ method: 'GET', url: '/api/imports' }).flush([imp(7, 'completed')]);
    vi.advanceTimersByTime(5000);
    ctx.ctrl.expectNone('/api/imports/7');
    ctx.ctrl.verify();
  });

  it('shows a translated note for duplicate items', () => {
    const ctx = setup();
    choose(ctx, [file('a.fit')]);
    clickUpload(ctx);
    postReq(ctx).flush(imp(8, 'processing', []), { status: 202, statusText: 'Accepted' });
    vi.advanceTimersByTime(0);
    ctx.ctrl
      .expectOne('/api/imports/8')
      .flush(
        imp(8, 'completed', [
          { filename: 'a.fit', status: 'duplicate', activity_id: 1, error_code: null },
        ]),
      );
    ctx.ctrl.expectOne({ method: 'GET', url: '/api/imports' }).flush([]);
    ctx.fixture.detectChanges();
    expect(q(ctx.el, 'results')!.textContent).toContain(itJson.import.duplicateNote);
    expect(q(ctx.el, 'summary')!.textContent).toContain('0 importate, 1 duplicata, 0 errori');
  });

  it('shows UPLOAD_TOO_LARGE on a 413', () => {
    const ctx = setup();
    choose(ctx, [file('a.zip')]);
    clickUpload(ctx);
    postReq(ctx).flush(
      { error: 'x', code: 'UPLOAD_TOO_LARGE', status: 413 },
      { status: 413, statusText: 'Payload Too Large' },
    );
    ctx.fixture.detectChanges();
    expect(q(ctx.el, 'error')!.textContent).toContain(itJson.errors.UPLOAD_TOO_LARGE);
    // i file restano in elenco per un nuovo tentativo
    expect(q(ctx.el, 'selected')!.textContent).toContain('a.zip');
  });

  it('shows UPLOAD_TOO_LARGE on a 413 without a JSON body (proxy rejection)', () => {
    const ctx = setup();
    choose(ctx, [file('a.zip')]);
    clickUpload(ctx);
    postReq(ctx).flush('too big', { status: 413, statusText: 'Payload Too Large' });
    ctx.fixture.detectChanges();
    expect(q(ctx.el, 'error')!.textContent).toContain(itJson.errors.UPLOAD_TOO_LARGE);
  });

  it('on 409 IMPORT_IN_PROGRESS shows the message and refreshes recent imports', () => {
    const ctx = setup();
    choose(ctx, [file('a.fit')]);
    clickUpload(ctx);
    postReq(ctx).flush(
      { error: 'x', code: 'IMPORT_IN_PROGRESS', status: 409 },
      { status: 409, statusText: 'Conflict' },
    );
    ctx.ctrl.expectOne({ method: 'GET', url: '/api/imports' }).flush([imp(5, 'processing')]);
    ctx.fixture.detectChanges();
    expect(q(ctx.el, 'error')!.textContent).toContain(itJson.errors.IMPORT_IN_PROGRESS);
    expect(q(ctx.el, 'recent')!.textContent).toContain(itJson.import.status.processing);
    expect(q(ctx.el, 'follow-5')).not.toBeNull();
  });

  it('follows a processing recent import when the user asks', () => {
    const ctx = setup();
    choose(ctx, [file('a.fit')]);
    clickUpload(ctx);
    postReq(ctx).flush(
      { error: 'x', code: 'IMPORT_IN_PROGRESS', status: 409 },
      { status: 409, statusText: 'Conflict' },
    );
    ctx.ctrl.expectOne({ method: 'GET', url: '/api/imports' }).flush([imp(5, 'processing')]);
    ctx.fixture.detectChanges();
    q<HTMLButtonElement>(ctx.el, 'follow-5')!.click();
    vi.advanceTimersByTime(0);
    ctx.ctrl
      .expectOne('/api/imports/5')
      .flush(
        imp(5, 'completed', [
          { filename: 'x.fit', status: 'imported', activity_id: 9, error_code: null },
        ]),
      );
    ctx.ctrl.expectOne({ method: 'GET', url: '/api/imports' }).flush([imp(5, 'completed')]);
    ctx.fixture.detectChanges();
    expect(q(ctx.el, 'results')!.textContent).toContain('x.fit');
  });

  it('starts polling automatically when the most recent import is processing on load', () => {
    const ctx = setup({ recent: [imp(9, 'processing'), imp(8, 'completed')] });
    vi.advanceTimersByTime(0);
    ctx.ctrl.expectOne('/api/imports/9').flush(imp(9, 'processing', []));
    vi.advanceTimersByTime(1000);
    ctx.ctrl.expectOne('/api/imports/9').flush(imp(9, 'processing', []));
  });

  it('does not poll on load when the most recent import is finished', () => {
    const ctx = setup({ recent: [imp(9, 'completed'), imp(8, 'processing')] });
    vi.advanceTimersByTime(3000);
    ctx.ctrl.expectNone('/api/imports/9');
    ctx.ctrl.expectNone('/api/imports/8');
  });

  it('stops polling when the component is destroyed', () => {
    const ctx = setup();
    choose(ctx, [file('a.fit')]);
    clickUpload(ctx);
    postReq(ctx).flush(imp(7, 'processing', []), { status: 202, statusText: 'Accepted' });
    vi.advanceTimersByTime(0);
    ctx.ctrl.expectOne('/api/imports/7').flush(imp(7, 'processing', []));

    ctx.fixture.destroy();
    vi.advanceTimersByTime(5000);
    ctx.ctrl.expectNone('/api/imports/7');
    ctx.ctrl.verify();
  });

  it('shows the error and stops polling when a poll request fails', () => {
    const ctx = setup();
    choose(ctx, [file('a.fit')]);
    clickUpload(ctx);
    postReq(ctx).flush(imp(7, 'processing', []), { status: 202, statusText: 'Accepted' });
    vi.advanceTimersByTime(0);
    ctx.ctrl
      .expectOne('/api/imports/7')
      .flush({ error: 'x', code: 'INTERNAL', status: 500 }, { status: 500, statusText: 'err' });
    ctx.fixture.detectChanges();
    expect(q(ctx.el, 'error')!.textContent).toContain(itJson.errors.INTERNAL);
    vi.advanceTimersByTime(3000);
    ctx.ctrl.expectNone('/api/imports/7');
  });

  it('resets uploading and reloads recent imports on a 202 with an empty body', () => {
    const ctx = setup();
    choose(ctx, [file('a.fit')]);
    clickUpload(ctx);
    postReq(ctx).flush(null, { status: 202, statusText: 'Accepted' });
    ctx.ctrl.expectOne({ method: 'GET', url: '/api/imports' }).flush([imp(5, 'processing')]);
    ctx.fixture.detectChanges();
    expect(q(ctx.el, 'progress')).toBeNull();
    expect(q<HTMLButtonElement>(ctx.el, 'upload')!.textContent).toContain(itJson.import.upload);
    // l'import in corso trovato nei recenti viene seguito
    vi.advanceTimersByTime(0);
    ctx.ctrl.expectOne('/api/imports/5').flush(imp(5, 'processing', []));
  });

  it('uses an indeterminate progress bar until a progress total is seen', () => {
    const ctx = setup();
    choose(ctx, [file('a.fit')]);
    clickUpload(ctx);
    const req = postReq(ctx);
    const bar = () => q(ctx.el, 'progress')!;
    expect(bar().classList.contains('mdc-linear-progress--indeterminate')).toBe(true);
    req.event({ type: HttpEventType.UploadProgress, loaded: 10 });
    ctx.fixture.detectChanges();
    expect(bar().classList.contains('mdc-linear-progress--indeterminate')).toBe(true);
    req.event({ type: HttpEventType.UploadProgress, loaded: 50, total: 100 });
    ctx.fixture.detectChanges();
    expect(bar().classList.contains('mdc-linear-progress--indeterminate')).toBe(false);
    expect(bar().getAttribute('aria-valuenow')).toBe('50');
  });

  it('does not cancel a slow poll request nor issue a second one while it is in flight', () => {
    const ctx = setup();
    choose(ctx, [file('a.fit')]);
    clickUpload(ctx);
    postReq(ctx).flush(imp(7, 'processing', []), { status: 202, statusText: 'Accepted' });
    vi.advanceTimersByTime(0);
    const open = ctx.ctrl.match('/api/imports/7');
    expect(open.length).toBe(1);

    // la GET resta in volo oltre un secondo: nessuna seconda richiesta, la prima non è annullata
    vi.advanceTimersByTime(3500);
    expect(ctx.ctrl.match('/api/imports/7').length).toBe(0);
    expect(open[0].cancelled).toBe(false);

    open[0].flush(
      imp(7, 'completed', [
        { filename: 'a.fit', status: 'imported', activity_id: 3, error_code: null },
      ]),
    );
    ctx.ctrl.expectOne({ method: 'GET', url: '/api/imports' }).flush([]);
    ctx.fixture.detectChanges();
    expect(q(ctx.el, 'summary')!.textContent).toContain('1 importata, 0 duplicate, 0 errori');
  });

  it('falls back to the generic message for an error code without a translation', () => {
    const ctx = setup();
    choose(ctx, [file('a.fit')]);
    clickUpload(ctx);
    postReq(ctx).flush(imp(7, 'processing', []), { status: 202, statusText: 'Accepted' });
    vi.advanceTimersByTime(0);
    ctx.ctrl
      .expectOne('/api/imports/7')
      .flush(
        imp(7, 'completed', [
          { filename: 'a.fit', status: 'failed', activity_id: null, error_code: 'BRAND_NEW_CODE' },
        ]),
      );
    ctx.ctrl.expectOne({ method: 'GET', url: '/api/imports' }).flush([]);
    ctx.fixture.detectChanges();
    expect(q(ctx.el, 'results')!.textContent).toContain(itJson.errors.GENERIC);
    expect(q(ctx.el, 'results')!.textContent).not.toContain('errors.BRAND_NEW_CODE');
  });

  it('shows the export instructions box', () => {
    const { el } = setup();
    const box = q(el, 'instructions')!;
    expect(box.textContent).toContain(itJson.import.instructionsSingle);
    expect(box.textContent).toContain(itJson.import.instructionsAll);
  });

  it('renders per-file results as a table on desktop and as cards on handset', () => {
    for (const handset of [false, true]) {
      TestBed.resetTestingModule();
      const ctx = setup({ handset });
      choose(ctx, [file('a.fit')]);
      clickUpload(ctx);
      postReq(ctx).flush(imp(7, 'processing', []), { status: 202, statusText: 'Accepted' });
      vi.advanceTimersByTime(0);
      ctx.ctrl
        .expectOne('/api/imports/7')
        .flush(
          imp(7, 'completed', [
            { filename: 'a.fit', status: 'imported', activity_id: 3, error_code: null },
          ]),
        );
      ctx.ctrl.expectOne({ method: 'GET', url: '/api/imports' }).flush([]);
      ctx.fixture.detectChanges();
      expect(ctx.el.querySelector('table') !== null).toBe(!handset);
      expect(ctx.el.querySelectorAll('[data-testid="result-card"]').length).toBe(handset ? 1 : 0);
      expect(q(ctx.el, 'results')!.textContent).toContain('a.fit');
    }
  });
});
