/** Stili condivisi dalle pagine di accesso (login e registrazione): scheda centrata, campi a tutta larghezza. */
export const AUTH_PAGE_STYLES = `
  :host { display: block; }
  .auth-page {
    box-sizing: border-box;
    max-width: 420px;
    margin: 0 auto;
    padding: 24px 16px;
  }
  .lang-row { display: flex; justify-content: flex-end; margin-bottom: 8px; }
  h1 { margin: 0 0 4px; font: var(--mat-sys-headline-medium); }
  h2 { margin: 0 0 16px; font: var(--mat-sys-title-medium); }
  form { display: flex; flex-direction: column; gap: 4px; }
  mat-form-field { width: 100%; }
  .notice { padding: 8px 12px; border-radius: 8px; background: var(--mat-sys-secondary-container); color: var(--mat-sys-on-secondary-container); }
  .error { padding: 8px 12px; border-radius: 8px; background: var(--mat-sys-error-container); color: var(--mat-sys-on-error-container); }
  .alt { margin-top: 16px; }
  fieldset { border: 0; margin: 0 0 12px; padding: 0; }
  legend { padding: 0; margin-bottom: 4px; font: var(--mat-sys-label-large); }
`;
