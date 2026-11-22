import { TranslocoTestingModule } from '@jsverse/transloco';
import enJson from '../../public/i18n/en.json';
import itJson from '../../public/i18n/it.json';

/** Modulo Transloco per i test: traduzioni reali it/en, lingua attiva italiano. */
export function translocoTesting() {
  return TranslocoTestingModule.forRoot({
    langs: { it: itJson, en: enJson },
    translocoConfig: {
      availableLangs: ['it', 'en'],
      defaultLang: 'it',
      reRenderOnLangChange: true,
    },
  });
}
