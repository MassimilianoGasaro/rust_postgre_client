import { Activity } from '../../../core/api/models';
import {
  DEFAULT_BAND,
  FitnessPoint,
  bucketStart,
  bucketize,
  bucketsInRange,
  efficiency,
  fitnessKpis,
  fitnessSportFor,
  granularityFor,
  hrBandFromProfile,
  linearFit,
  metricFor,
  paceSecPerKm,
  rollingMean,
  splitByTime,
  toPoints,
} from './fitness-metrics';

const activity = (id: number, over: Partial<Activity> = {}): Activity => ({
  id,
  source: 'file_upload',
  sport: 'running',
  sport_raw: 'running',
  name: null,
  start_time: '2026-11-20T08:30:00Z',
  utc_offset_seconds: 3600,
  elapsed_s: 3700,
  moving_s: 3600,
  distance_m: 10000,
  elevation_gain_m: null,
  avg_hr: 145,
  max_hr: 170,
  avg_speed_mps: 2.8,
  avg_power_w: null,
  avg_cadence: null,
  calories: null,
  file_format: 'fit',
  ...over,
});

const point = (day: string, over: Partial<FitnessPoint> = {}): FitnessPoint => ({
  id: 1,
  t: Date.parse(`${day}T08:00:00Z`),
  hr: 145,
  speedMps: 3,
  movingS: 3600,
  distanceM: 10800,
  ...over,
});

describe('fitnessSportFor / metricFor', () => {
  it('analyses running when no sport is filtered', () => {
    expect(fitnessSportFor('all')).toBe('running');
  });

  it('keeps supported sports and rejects the others', () => {
    expect(fitnessSportFor('cycling')).toBe('cycling');
    expect(fitnessSportFor('swimming')).toBeNull();
    expect(fitnessSportFor('strength')).toBeNull();
  });

  it('uses speed for cycling and pace otherwise', () => {
    expect(metricFor('cycling')).toBe('speed');
    expect(metricFor('running')).toBe('pace');
    expect(metricFor('hiking')).toBe('pace');
  });
});

describe('toPoints', () => {
  it('keeps only valid activities of the sport, sorted by local time', () => {
    const points = toPoints(
      [
        activity(1, { start_time: '2026-11-21T08:00:00Z' }),
        activity(2, { start_time: '2026-11-19T08:00:00Z' }),
        activity(3, { sport: 'cycling' }),
        activity(4, { avg_hr: null }),
        activity(5, { moving_s: 600 }),
        activity(6, { avg_speed_mps: null, distance_m: null }),
      ],
      'running',
    );
    expect(points.map((p) => p.id)).toEqual([2, 1]);
  });

  it('shifts the start by the UTC offset', () => {
    const [p] = toPoints([activity(1)], 'running');
    expect(new Date(p.t).getUTCHours()).toBe(9);
  });

  it('derives speed from distance and moving time when missing', () => {
    const [p] = toPoints([activity(1, { avg_speed_mps: null })], 'running');
    expect(p.speedMps).toBeCloseTo(10000 / 3600);
  });

  it('falls back to elapsed time without moving time', () => {
    const [p] = toPoints([activity(1, { moving_s: null })], 'running');
    expect(p.movingS).toBe(3700);
  });
});

describe('efficiency and pace', () => {
  it('computes metres per minute per beat', () => {
    expect(efficiency({ speedMps: 3, hr: 150 })).toBeCloseTo(1.2);
  });

  it('converts speed to seconds per km', () => {
    expect(paceSecPerKm(4)).toBe(250);
  });
});

describe('rollingMean', () => {
  it('averages values inside the trailing window', () => {
    const pts = [
      point('2026-01-01', { hr: 100 }),
      point('2026-01-10', { hr: 200 }),
      point('2026-03-01', { hr: 300 }),
    ];
    expect(rollingMean(pts, (p) => p.hr, 28)).toEqual([100, 150, 300]);
  });
});

describe('linearFit', () => {
  it('fits a straight line', () => {
    const fit = linearFit([1, 2, 3], [3, 5, 7])!;
    expect(fit.slope).toBeCloseTo(2);
    expect(fit.intercept).toBeCloseTo(1);
  });

  it('returns null with fewer than 2 points or constant x', () => {
    expect(linearFit([1], [1])).toBeNull();
    expect(linearFit([2, 2], [1, 3])).toBeNull();
  });
});

describe('hrBandFromProfile', () => {
  it('uses Karvonen 60–70% of the heart-rate reserve', () => {
    expect(hrBandFromProfile(190, 50)).toEqual({ min: 134, max: 148 });
  });

  it('falls back to 65–75% of max HR without resting HR', () => {
    expect(hrBandFromProfile(200, null)).toEqual({ min: 130, max: 150 });
  });

  it('returns null without max HR', () => {
    expect(hrBandFromProfile(null, 50)).toBeNull();
  });
});

describe('periods', () => {
  it('uses weeks up to ~4 months and months beyond', () => {
    expect(granularityFor({ from: '2026-08-01', to: '2026-11-22' })).toBe('week');
    expect(granularityFor({ from: '2025-11-23', to: '2026-11-22' })).toBe('month');
  });

  it('starts weeks on Monday and months on the 1st', () => {
    // 2026-11-22 è domenica
    expect(bucketStart(Date.parse('2026-11-22T20:00:00Z'), 'week')).toBe('2026-11-16');
    expect(bucketStart(Date.parse('2026-11-22T20:00:00Z'), 'month')).toBe('2026-11-01');
  });

  it('lists every period of the range', () => {
    expect(bucketsInRange({ from: '2026-11-04', to: '2026-11-22' }, 'week')).toEqual([
      '2026-11-02',
      '2026-11-09',
      '2026-11-16',
    ]);
    expect(bucketsInRange({ from: '2026-09-15', to: '2026-11-22' }, 'month')).toEqual([
      '2026-09-01',
      '2026-10-01',
      '2026-11-01',
    ]);
  });

  it('assigns points to their period, leaving empty periods', () => {
    const buckets = bucketize(
      [point('2026-11-05'), point('2026-11-20'), point('2026-11-21')],
      { from: '2026-11-02', to: '2026-11-22' },
      'week',
    );
    expect(buckets.map((b) => b.points.length)).toEqual([1, 0, 2]);
  });

  it('splits points by time across the range', () => {
    const groups = splitByTime(
      [point('2026-11-01'), point('2026-11-15'), point('2026-11-25')],
      { from: '2026-11-01', to: '2026-11-30' },
      3,
    );
    expect(groups.map((g) => g.length)).toEqual([1, 1, 1]);
  });
});

describe('fitnessKpis', () => {
  const range = { from: '2026-11-01', to: '2026-11-30' };

  it('compares the second half of the period with the first', () => {
    const k = fitnessKpis(
      [
        point('2026-11-03', { speedMps: 3, hr: 145, movingS: 3000, distanceM: 9000 }),
        point('2026-11-25', { speedMps: 3.2, hr: 145, movingS: 4200, distanceM: 13440 }),
      ],
      range,
      DEFAULT_BAND,
      'pace',
    );
    // passo: 1000/3 ≈ 333 s/km -> 1000/3.2 = 312,5 s/km
    expect(k.bandMetric!.delta).toBeCloseTo(312.5 - 1000 / 3);
    expect(k.efficiency!.delta).toBeCloseTo(
      efficiency({ speedMps: 3.2, hr: 145 }) - efficiency({ speedMps: 3, hr: 145 }),
    );
    expect(k.longestInBand).toEqual({ value: 4200, delta: 1200 });
  });

  it('ignores activities outside the band for band KPIs', () => {
    const k = fitnessKpis([point('2026-11-03', { hr: 170 })], range, DEFAULT_BAND, 'pace');
    expect(k.bandMetric).toBeNull();
    expect(k.longestInBand).toBeNull();
    expect(k.efficiency!.delta).toBeNull();
  });
});
