import { formatActivityStart } from './activity-format';

describe('formatActivityStart', () => {
  const iso = '2026-11-22T10:33:00Z';

  it('is day-first in English as well, like the chart labels', () => {
    expect(formatActivityStart(iso, 0, 'en')).toBe('22/11/2026, 10:33');
  });

  it('uses the Italian format with the activity offset', () => {
    expect(formatActivityStart(iso, 3600, 'it')).toBe('22/11/26, 11:33');
  });
});
