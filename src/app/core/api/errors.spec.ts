import { HttpErrorResponse } from '@angular/common/http';
import { KNOWN_ERROR_CODES, errorCodeKey, errorKey } from './errors';
import enJson from '../../../../public/i18n/en.json';
import itJson from '../../../../public/i18n/it.json';

describe('errorKey', () => {
  it('maps a backend error code to errors.<CODE>', () => {
    const err = new HttpErrorResponse({
      status: 409,
      error: { error: 'Email già registrata', code: 'EMAIL_TAKEN', status: 409 },
    });
    expect(errorKey(err)).toBe('errors.EMAIL_TAKEN');
  });

  it('falls back to errors.GENERIC on a network error', () => {
    const err = new HttpErrorResponse({ status: 0, error: new ProgressEvent('error') });
    expect(errorKey(err)).toBe('errors.GENERIC');
  });

  it('falls back to errors.GENERIC when the body has no string code', () => {
    expect(errorKey(new HttpErrorResponse({ status: 500, error: { code: 42 } }))).toBe(
      'errors.GENERIC',
    );
    expect(
      errorKey(new HttpErrorResponse({ status: 502, error: '<html>Bad gateway</html>' })),
    ).toBe('errors.GENERIC');
    expect(errorKey(new HttpErrorResponse({ status: 500, error: null }))).toBe('errors.GENERIC');
  });

  it('falls back to errors.GENERIC for non-HTTP errors', () => {
    expect(errorKey(new Error('boom'))).toBe('errors.GENERIC');
    expect(errorKey(undefined)).toBe('errors.GENERIC');
  });

  it('falls back to errors.GENERIC for a code without a translation', () => {
    const err = new HttpErrorResponse({ status: 418, error: { code: 'TEAPOT' } });
    expect(errorKey(err)).toBe('errors.GENERIC');
  });
});

describe('errorCodeKey', () => {
  it('maps a known code, and unknown or missing codes to errors.GENERIC', () => {
    expect(errorCodeKey('NOT_FOUND')).toBe('errors.NOT_FOUND');
    expect(errorCodeKey('TEAPOT')).toBe('errors.GENERIC');
    expect(errorCodeKey(null)).toBe('errors.GENERIC');
    expect(errorCodeKey(undefined)).toBe('errors.GENERIC');
  });
});

describe('KNOWN_ERROR_CODES', () => {
  it.each([
    ['it', itJson],
    ['en', enJson],
  ])('equals the errors.* keys of %s.json minus GENERIC', (_lang, json) => {
    const expected = Object.keys(json.errors).filter((k) => k !== 'GENERIC').sort();
    expect([...KNOWN_ERROR_CODES].sort()).toEqual(expected);
  });
});
