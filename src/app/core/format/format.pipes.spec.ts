import { TestBed } from '@angular/core/testing';
import { TranslocoService, TranslocoTestingModule } from '@jsverse/transloco';
import { DistanceKmPipe, DurationPipe } from './format.pipes';

describe('DurationPipe', () => {
  const pipe = new DurationPipe();

  it('formats hours as h:mm', () => {
    expect(pipe.transform(3900)).toBe('1:05');
    expect(pipe.transform(3600)).toBe('1:00');
    expect(pipe.transform(7384)).toBe('2:03');
  });

  it('formats sub-hour durations as m:ss', () => {
    expect(pipe.transform(570)).toBe('9:30');
    expect(pipe.transform(59)).toBe('0:59');
    expect(pipe.transform(0)).toBe('0:00');
    expect(pipe.transform(3599)).toBe('59:59');
  });

  it('rounds fractional seconds and shows a dash for missing values', () => {
    expect(pipe.transform(569.6)).toBe('9:30');
    expect(pipe.transform(null)).toBe('—');
    expect(pipe.transform(undefined)).toBe('—');
    expect(pipe.transform(NaN)).toBe('—');
  });
});

describe('DistanceKmPipe', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: { it: {}, en: {} },
          translocoConfig: { availableLangs: ['it', 'en'], defaultLang: 'it' },
        }),
      ],
    });
  });

  const make = () => TestBed.runInInjectionContext(() => new DistanceKmPipe());

  it('uses the decimal comma in Italian', () => {
    expect(make().transform(12345)).toBe('12,3 km');
  });

  it('follows the active language (decimal point in English) without a new pipe instance', () => {
    const pipe = make();
    expect(pipe.transform(12345)).toBe('12,3 km');
    TestBed.inject(TranslocoService).setActiveLang('en');
    expect(pipe.transform(12345)).toBe('12.3 km');
  });

  it('always shows one decimal and a dash for missing values', () => {
    const pipe = make();
    expect(pipe.transform(0)).toBe('0,0 km');
    expect(pipe.transform(10000)).toBe('10,0 km');
    expect(pipe.transform(null)).toBe('—');
    expect(pipe.transform(undefined)).toBe('—');
  });
});
