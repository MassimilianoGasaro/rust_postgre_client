import { TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AthletesPage } from './athletes.page';
import { LinkedAthlete } from '../../core/api/models';
import { translocoTesting } from '../../testing';
import itJson from '../../../../public/i18n/it.json';

const athlete = (id: number, username: string): LinkedAthlete => ({
  id,
  username,
  linked_since: '2026-10-15T08:00:00Z',
});

async function setup(athletes: LinkedAthlete[] = [athlete(5, 'mario'), athlete(6, 'luca')]) {
  TestBed.configureTestingModule({
    imports: [AthletesPage, translocoTesting()],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([{ path: 'coach/athletes/:id', children: [] }]),
    ],
  });
  const ctrl = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(AthletesPage);
  fixture.detectChanges();
  ctrl.expectOne('/api/athletes').flush(athletes);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, ctrl };
}

const items = (el: HTMLElement) =>
  Array.from(el.querySelectorAll<HTMLAnchorElement>('[data-testid="athlete-item"]'));

describe('AthletesPage', () => {
  it('lists the active athletes with username and "following since" date', async () => {
    const { el } = await setup();
    expect(items(el).length).toBe(2);
    expect(items(el)[0].textContent).toContain('mario');
    expect(items(el)[0].textContent).toMatch(/seguito dal .*2026/);
    expect(items(el)[1].textContent).toContain('luca');
  });

  it('clicking an athlete navigates to the detail page', async () => {
    const { el, fixture } = await setup();
    items(el)[1].click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(TestBed.inject(Location).path()).toBe('/coach/athletes/6');
  });

  it('shows the translated empty state', async () => {
    const { el } = await setup([]);
    expect(items(el).length).toBe(0);
    expect(el.textContent).toContain(itJson.coach.athletes.empty);
  });

  it('shows a translated error when the list cannot be loaded', async () => {
    TestBed.configureTestingModule({
      imports: [AthletesPage, translocoTesting()],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    const ctrl = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(AthletesPage);
    fixture.detectChanges();
    ctrl
      .expectOne('/api/athletes')
      .flush({ error: 'x', code: 'INTERNAL', status: 500 }, { status: 500, statusText: 'E' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(itJson.errors.INTERNAL);
    expect(fixture.nativeElement.textContent).not.toContain(itJson.coach.athletes.empty);
  });
});
