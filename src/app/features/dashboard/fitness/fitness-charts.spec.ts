import { ChartContext } from '../dashboard-charts';
import {
  bandOption,
  efficiencyOption,
  enduranceOption,
  formatMetric,
  formatPace,
  paceHrOption,
} from './fitness-charts';
import { FitnessPoint, bucketize } from './fitness-metrics';

const ctx: ChartContext = { lang: 'it', t: (key) => key };

const point = (day: string, over: Partial<FitnessPoint> = {}): FitnessPoint => {
  const p = {
    id: 1,
    t: Date.parse(`${day}T08:00:00Z`),
    hr: 145,
    speedMps: 3,
    movingS: 3600,
    ...over,
  };
  return { distanceM: p.speedMps * p.movingS, ...p };
};

type Series = { type: string; name?: string; data: unknown[] };
const series = (o: unknown) => (o as { series: Series[] }).series;
const tooltip = (o: unknown) =>
  (o as { tooltip: { formatter: (p: unknown) => string } }).tooltip.formatter;

const range = { from: '2026-11-02', to: '2026-11-29' };
const points = [
  point('2026-11-03', { hr: 140, speedMps: 2.9 }),
  point('2026-11-05', { hr: 150, speedMps: 3.1 }),
  point('2026-11-26', { hr: 140, speedMps: 3.1 }),
  point('2026-11-28', { hr: 150, speedMps: 3.3 }),
];

describe('formatting', () => {
  it('formats pace as m:ss', () => {
    expect(formatPace(307.4)).toBe('5:07');
    expect(formatPace(59.6)).toBe('1:00');
  });

  it('formats pace and speed with units', () => {
    expect(formatMetric(312, 'pace', 'it')).toBe('5:12 /km');
    expect(formatMetric(28.44, 'speed', 'it')).toBe('28,4 km/h');
  });
});

describe('efficiencyOption', () => {
  it('plots one dot per activity plus the rolling average', () => {
    const [dots, line] = series(efficiencyOption(points, 'pace', ctx));
    expect(dots.type).toBe('scatter');
    expect(dots.data).toHaveLength(4);
    expect(line.type).toBe('line');
    expect(line.data).toHaveLength(4);
  });

  it('shows date, HR and pace in the tooltip', () => {
    const html = tooltip(efficiencyOption(points, 'pace', ctx))({ dataIndex: 0, seriesIndex: 0 });
    expect(html).toContain('03/11/26');
    expect(html).toContain('140 bpm');
    expect(html).toContain('/km');
  });
});

describe('paceHrOption', () => {
  it('groups activities by thirds of the period with a trend line each', () => {
    const s = series(paceHrOption(points, range, 'pace', ctx));
    const scatter = s.filter((x) => x.type === 'scatter');
    const lines = s.filter((x) => x.type === 'line');
    expect(scatter.map((x) => x.data.length)).toEqual([2, 0, 2]);
    // la terza parte vuota non ha retta
    expect(lines).toHaveLength(2);
    expect(lines.map((l) => l.name)).toEqual([
      'dashboard.fitness.paceHr.early',
      'dashboard.fitness.paceHr.recent',
    ]);
  });

  it('plots heart rate on x and pace (s/km) on y', () => {
    const [first] = series(paceHrOption(points, range, 'pace', ctx));
    expect(first.data[0]).toEqual([140, Math.round((1000 / 2.9) * 100) / 100]);
  });
});

describe('bandOption / enduranceOption', () => {
  const band = { min: 135, max: 145 };
  const buckets = bucketize(points, range, 'week');

  it('averages pace only over activities inside the band, null for empty periods', () => {
    const [line] = series(bandOption(buckets, band, 'week', 'pace', ctx));
    expect(line.data).toEqual([Math.round((1000 / 2.9) * 100) / 100, null, null, 322.58]);
  });

  it('uses speed in km/h for cycling', () => {
    const [line] = series(bandOption(buckets, band, 'week', 'speed', ctx));
    expect(line.data[0]).toBeCloseTo(10.44);
  });

  it('plots the longest in-band activity per period in minutes', () => {
    const [line] = series(enduranceOption(buckets, band, 'week', ctx));
    expect(line.data).toEqual([60, null, null, 60]);
  });
});
