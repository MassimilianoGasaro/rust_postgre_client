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

  it.each(['it', 'en-GB'])('rejects a 2-digit year instead of reading it month-first (%s)', (locale) => {
    expect(adapter(locale).parse('05/03/90', null)?.getTime()).toBeNaN();
    expect(adapter(locale).parse('5.3.90', null)?.getTime()).toBeNaN();
  });

  it.each(['it', 'en-GB'])('parses 05/03/1990 as 5 March 1990 (%s)', (locale) => {
    const date = adapter(locale).parse('05/03/1990', null)!;
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([1990, 2, 5]);
  });

  it.each(['it', 'en-GB'])('rejects 31/02/2026 (%s)', (locale) => {
    expect(adapter(locale).parse('31/02/2026', null)?.getTime()).toBeNaN();
  });
});
