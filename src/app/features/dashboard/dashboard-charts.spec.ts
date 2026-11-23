import { StatsSummary } from '../../core/api/models';
import { ChartContext, barOption, donutOption, periodLabel } from './dashboard-charts';

const ctx = (lang: 'it' | 'en'): ChartContext => ({
  lang,
  t: (key) => (key === 'dashboard.chart.weekPrefix' ? (lang === 'it' ? 'sett.' : 'wk') : key),
});

describe('periodLabel', () => {
  it('formats a day as dd/MM', () => {
    expect(periodLabel('2026-03-07', 'day', ctx('it'))).toBe('07/03');
  });

  it('formats a week with the translated prefix', () => {
    expect(periodLabel('2026-11-16', 'week', ctx('it'))).toBe('sett. 16/11');
    expect(periodLabel('2026-11-16', 'week', ctx('en'))).toBe('wk 16/11');
  });

  it('formats a month as MMM yyyy in the active language', () => {
    expect(periodLabel('2026-11-01', 'month', ctx('it'))).toBe('nov 2026');
    expect(periodLabel('2026-11-01', 'month', ctx('en'))).toBe('Nov 2026');
  });

  it('falls back to the raw value for an invalid date', () => {
    expect(periodLabel('oops', 'day', ctx('it'))).toBe('oops');
  });
});

describe('barOption tooltip', () => {
  const stats = {
    granularity: 'day',
    series: [
      {
        period_start: '2026-11-20',
        count: 2,
        distance_m: 12345,
        moving_s: 4500,
        elevation_gain_m: 0,
      },
    ],
  } as StatsSummary;

  it('shows distance, moving time and count for the hovered period', () => {
    const option = barOption(stats, ctx('it')) as {
      tooltip: { formatter: (p: unknown) => string };
    };
    const html = option.tooltip.formatter([{ dataIndex: 0 }]);
    expect(html).toContain('20/11');
    expect(html).toContain('12,3 km');
    expect(html).toContain('1:15');
    expect(html).toContain('2');
  });
});

describe('chart accessibility', () => {
  const stats = {
    granularity: 'day',
    series: [],
    by_sport: [],
  } as unknown as StatsSummary;

  it('enables ECharts aria with the translated chart title as description', () => {
    const bar = barOption(stats, ctx('it')) as { aria: unknown };
    const donut = donutOption(stats, ctx('it')) as { aria: unknown };
    expect(bar.aria).toEqual({
      enabled: true,
      label: { description: 'dashboard.chart.distanceTitle' },
    });
    expect(donut.aria).toEqual({
      enabled: true,
      label: { description: 'dashboard.chart.sportTitle' },
    });
  });
});
