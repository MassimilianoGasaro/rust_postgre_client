import { dateLocale } from './date-locale';

describe('dateLocale', () => {
  it('maps the UI languages to day-first locales', () => {
    expect(dateLocale('it')).toBe('it');
    expect(dateLocale('en')).toBe('en-GB');
  });
});
