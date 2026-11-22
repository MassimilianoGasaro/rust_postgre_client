import { HttpErrorResponse } from '@angular/common/http';
import { errorKey } from './errors';

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
});
