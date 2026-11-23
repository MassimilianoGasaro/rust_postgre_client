import { TestBed } from '@angular/core/testing';
import { LocalDateAdapter } from './local-date-adapter';

describe('LocalDateAdapter', () => {
  function adapter(locale: string): LocalDateAdapter {
    const a = TestBed.runInInjectionContext(() => new LocalDateAdapter());
    a.setLocale(locale);
    return a;
  }

  it.each(['it', 'en-GB'])('parses typed dates day-first with locale %s', (locale) => {
    const date = adapter(locale).parse('24/11/2025', null)!;
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2025, 10, 24]);
  });

  it('rejects an impossible day-first date', () => {
    expect(adapter('en-GB').parse('31/02/2025', null)?.getTime()).toBeNaN();
  });
});
