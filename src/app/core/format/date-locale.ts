/**
 * Locale usato per date e orari: giorno-mese-anno in entrambe le lingue, così tabelle,
 * grafici (`dd/MM`) e campi data concordano. L'inglese usa `en-GB`; i numeri restano nella lingua UI.
 */
export function dateLocale(lang: string): string {
  return lang === 'en' ? 'en-GB' : lang;
}
