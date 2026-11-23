import { mediumDate } from './medium-date';

describe('mediumDate', () => {
  it('formats an ISO timestamp in the given language', () => {
    expect(mediumDate('2026-11-15T12:00:00Z', 'en')).toBe('15 Nov 2026');
    expect(mediumDate('2026-11-15T12:00:00Z', 'it')).toBe('15 nov 2026');
  });
});
