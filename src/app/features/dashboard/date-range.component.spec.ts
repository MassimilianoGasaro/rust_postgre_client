import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DateRange } from '../../core/api/models';
import { TODAY } from '../../core/time/today';
import { translocoTesting } from '../../testing';
import { DateRangeComponent } from './date-range.component';

@Component({
  imports: [DateRangeComponent],
  template: `<app-date-range [value]="range()" (valueChange)="range.set($event)" />`,
})
class HostComponent {
  readonly range = signal<DateRange | undefined>(undefined);
}

function setup(initial?: DateRange) {
  TestBed.configureTestingModule({
    imports: [HostComponent, translocoTesting()],
    providers: [{ provide: TODAY, useValue: () => new Date(2026, 10, 22, 15, 30) }],
  });
  const fixture = TestBed.createComponent(HostComponent);
  if (initial) fixture.componentInstance.range.set(initial);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const click = (testId: string) => {
    el.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)!.click();
    fixture.detectChanges();
  };
  return { fixture, el, host: fixture.componentInstance, click };
}

const pressed = (el: HTMLElement) =>
  Array.from(el.querySelectorAll<HTMLButtonElement>('[aria-pressed="true"]')).map((b) =>
    b.getAttribute('data-testid'),
  );

describe('DateRangeComponent', () => {
  it('defaults to the last 30 days including today when no value is given', () => {
    const { host, el } = setup();
    expect(host.range()).toEqual({ from: '2026-10-24', to: '2026-11-22' });
    expect(pressed(el)).toEqual(['preset-30d']);
  });

  it.each([
    ['7d', { from: '2026-11-16', to: '2026-11-22' }],
    ['30d', { from: '2026-10-24', to: '2026-11-22' }],
    ['90d', { from: '2026-08-25', to: '2026-11-22' }],
    ['1y', { from: '2025-11-23', to: '2026-11-22' }],
  ])('preset %s uses the browser local date', (preset, expected) => {
    const { host, click } = setup({ from: '2000-01-01', to: '2000-01-02' });
    click(`preset-${preset}`);
    expect(host.range()).toEqual(expected);
  });

  it('shows the custom picker for a value that matches no preset', () => {
    const { el } = setup({ from: '2026-01-01', to: '2026-02-01' });
    expect(pressed(el)).toEqual(['preset-custom']);
    expect(el.querySelector('mat-date-range-input')).not.toBeNull();
  });

  it('hides the custom picker when a preset is active', () => {
    const { el } = setup({ from: '2026-11-16', to: '2026-11-22' });
    expect(pressed(el)).toEqual(['preset-7d']);
    expect(el.querySelector('mat-date-range-input')).toBeNull();
  });

  it('keeps the current range and opens the picker when choosing custom', () => {
    const { host, el, click } = setup({ from: '2026-11-16', to: '2026-11-22' });
    click('preset-custom');
    expect(host.range()).toEqual({ from: '2026-11-16', to: '2026-11-22' });
    expect(el.querySelector('mat-date-range-input')).not.toBeNull();
    expect(pressed(el)).toEqual(['preset-custom']);
  });

  /** Digita una data nel formato del locale attivo (it) e notifica il cambio. */
  const type = (input: HTMLInputElement, value: string) => {
    input.value = value;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('change'));
  };

  it('emits an ISO range (no UTC shift) once both custom dates are picked', () => {
    const { host, el, fixture, click } = setup({ from: '2026-11-16', to: '2026-11-22' });
    click('preset-custom');
    const [start, end] = Array.from(
      el.querySelectorAll<HTMLInputElement>('mat-date-range-input input'),
    );
    type(start, '02/01/2026');
    type(end, '20/01/2026');
    fixture.detectChanges();
    expect(host.range()).toEqual({ from: '2026-01-02', to: '2026-01-20' });
  });

  it('with an existing range, changing the start alone emits nothing; setting the end emits once', () => {
    const { host, el, fixture, click } = setup({ from: '2026-11-16', to: '2026-11-22' });
    click('preset-custom');
    const [start, end] = Array.from(
      el.querySelectorAll<HTMLInputElement>('mat-date-range-input input'),
    );
    const before = host.range();
    type(start, '02/01/2026');
    fixture.detectChanges();
    // metà selezione: nessun intervallo applicato (niente ricarica né URL riscritto)
    expect(host.range()).toBe(before);
    type(end, '20/01/2026');
    fixture.detectChanges();
    expect(host.range()).toEqual({ from: '2026-01-02', to: '2026-01-20' });
  });

  it('does not emit a range whose end precedes its start', () => {
    const { host, el, click } = setup({ from: '2026-11-16', to: '2026-11-22' });
    click('preset-custom');
    const [start, end] = Array.from(
      el.querySelectorAll<HTMLInputElement>('mat-date-range-input input'),
    );
    type(start, '25/12/2026');
    type(end, '20/12/2026');
    expect(host.range()).toEqual({ from: '2026-11-16', to: '2026-11-22' });
  });

  it('does not emit dates outside 1900..2200', () => {
    const { host, el, click } = setup({ from: '2026-11-16', to: '2026-11-22' });
    click('preset-custom');
    const [start, end] = Array.from(
      el.querySelectorAll<HTMLInputElement>('mat-date-range-input input'),
    );
    type(start, '01/01/1850');
    type(end, '01/01/2026');
    expect(host.range()).toEqual({ from: '2026-11-16', to: '2026-11-22' });
  });
});
