/**
 * Ambiente di produzione (sostituisce environment.ts in `ng build`): indirizzo pubblico del
 * backend su Render, senza `/` finale. Va aggiornato se il servizio Render ha un altro nome.
 */
export const environment = {
  apiBaseUrl: 'https://rust-postgre-api.onrender.com',
};
