import enJson from '../../public/i18n/en.json';
import itJson from '../../public/i18n/it.json';

/** Appiattisce un oggetto annidato in chiavi puntate (es. "app.title"). */
function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value !== null && typeof value === 'object'
      ? flattenKeys(value as Record<string, unknown>, path)
      : [path];
  });
}

describe('i18n keys', () => {
  it('it.json and en.json have the same set of keys', () => {
    const keysIt = flattenKeys(itJson).sort();
    const keysEn = flattenKeys(enJson).sort();
    expect(keysIt.length).toBeGreaterThan(0);
    expect(keysIt).toEqual(keysEn);
  });
});
