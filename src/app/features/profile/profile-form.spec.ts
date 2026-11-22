import { Me } from '../../core/api/models';
import {
  ProfileFormValue,
  buildPatch,
  formValueFrom,
  paceToSeconds,
  secondsToPace,
  timezoneOptions,
} from './profile-form';

const me = (overrides: Partial<Me['profile']> = {}): Me => ({
  id: 1,
  email: 'a@b.it',
  username: 'mario',
  role: 'athlete',
  created_at: '2026-01-01T00:00:00Z',
  profile: {
    language: 'it',
    timezone: 'Europe/Rome',
    birth_date: '1990-03-15',
    sex: 'male',
    weight_kg: 70.5,
    max_hr: 190,
    resting_hr: 50,
    ftp_watts: 250,
    threshold_pace_s_per_km: 270,
    ...overrides,
  },
});

describe('pace conversion', () => {
  it('converts m:ss to seconds', () => {
    expect(paceToSeconds('4:30')).toBe(270);
    expect(paceToSeconds(' 5:05 ')).toBe(305);
    expect(paceToSeconds('10:00')).toBe(600);
    expect(paceToSeconds('100:00')).toBe(6000);
  });

  it('rejects malformed or zero paces', () => {
    for (const bad of [
      '',
      '430',
      '4:6',
      '4:60',
      '4:300',
      '1000:00',
      'a:bc',
      '0:00',
      '-4:30',
      '4.30',
    ]) {
      expect(paceToSeconds(bad), bad).toBeNull();
    }
  });

  it('formats seconds as m:ss', () => {
    expect(secondsToPace(270)).toBe('4:30');
    expect(secondsToPace(305)).toBe('5:05');
    expect(secondsToPace(null)).toBe('');
  });
});

describe('timezoneOptions', () => {
  it('uses Intl.supportedValuesOf when available and always offers UTC', () => {
    const intl = { supportedValuesOf: () => ['Europe/Rome', 'Asia/Tokyo'] };
    expect(timezoneOptions(intl)).toEqual(['Asia/Tokyo', 'Europe/Rome', 'UTC']);
  });

  it('falls back to a built-in list when Intl.supportedValuesOf is missing or throws', () => {
    const missing = timezoneOptions({});
    expect(missing).toContain('Europe/Rome');
    expect(missing).toContain('UTC');
    const throwing = timezoneOptions({
      supportedValuesOf: () => {
        throw new RangeError('x');
      },
    });
    expect(throwing).toEqual(missing);
  });

  it('includes an extra zone (the stored one) when not in the list', () => {
    expect(timezoneOptions({ supportedValuesOf: () => ['Europe/Rome'] }, 'Etc/Weird')).toContain(
      'Etc/Weird',
    );
  });
});

describe('buildPatch', () => {
  const base = (m: Me): ProfileFormValue => formValueFrom(m);

  it('a stored pace of 6000 s or more keeps the round trip', () => {
    expect(secondsToPace(6000)).toBe('100:00');
    const m = me({ threshold_pace_s_per_km: 6000 });
    expect(buildPatch(m, base(m), true)).toEqual({});
  });

  it('is empty when nothing changed', () => {
    const m = me();
    expect(buildPatch(m, base(m), true)).toEqual({});
  });

  it('sends only the changed fields', () => {
    const m = me();
    const patch = buildPatch(m, { ...base(m), username: 'luigi', maxHr: 185 }, true);
    expect(patch).toEqual({ username: 'luigi', max_hr: 185 });
  });

  it('clearing a nullable field sends null', () => {
    const m = me();
    const patch = buildPatch(
      m,
      {
        ...base(m),
        weightKg: null,
        maxHr: null,
        restingHr: null,
        ftpWatts: null,
        thresholdPace: '',
        sex: '',
        birthDate: null,
      },
      true,
    );
    expect(patch).toEqual({
      weight_kg: null,
      max_hr: null,
      resting_hr: null,
      ftp_watts: null,
      threshold_pace_s_per_km: null,
      sex: null,
      birth_date: null,
    });
  });

  it('converts pace 4:30 to 270 seconds', () => {
    const m = me({ threshold_pace_s_per_km: null });
    expect(buildPatch(m, { ...base(m), thresholdPace: '4:30' }, true)).toEqual({
      threshold_pace_s_per_km: 270,
    });
  });

  it('rounds weight to one decimal', () => {
    const m = me();
    expect(buildPatch(m, { ...base(m), weightKg: 71.26 }, true)).toEqual({ weight_kg: 71.3 });
  });

  it('does not round an untouched weight stored with more decimals', () => {
    const m = me({ weight_kg: 70.55 });
    expect(buildPatch(m, base(m), true)).toEqual({});
  });

  it('formats the birth date as YYYY-MM-DD without UTC shift', () => {
    const m = me();
    expect(buildPatch(m, { ...base(m), birthDate: new Date(1991, 0, 2) }, true)).toEqual({
      birth_date: '1991-01-02',
    });
  });

  it('adds current_password only when email or password change', () => {
    const m = me();
    expect(buildPatch(m, { ...base(m), email: 'x@y.it', currentPassword: 'old' }, true)).toEqual({
      email: 'x@y.it',
      current_password: 'old',
    });
    expect(
      buildPatch(m, { ...base(m), password: 'newpassword', currentPassword: 'old' }, true),
    ).toEqual({ password: 'newpassword', current_password: 'old' });
    expect(buildPatch(m, { ...base(m), username: 'luigi', currentPassword: 'old' }, true)).toEqual({
      username: 'luigi',
    });
  });

  it('ignores physiological fields for non-athletes', () => {
    const m = me();
    expect(buildPatch(m, { ...base(m), maxHr: 100, weightKg: 1 }, false)).toEqual({});
  });

  it('sends language and timezone when changed', () => {
    const m = me();
    expect(buildPatch(m, { ...base(m), language: 'en', timezone: 'UTC' }, true)).toEqual({
      language: 'en',
      timezone: 'UTC',
    });
  });
});
