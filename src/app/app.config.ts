import { ApplicationConfig, isDevMode, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideTransloco } from '@jsverse/transloco';
import { provideEchartsCore } from 'ngx-echarts';

import { routes } from './app.routes';
import { apiBaseUrlInterceptor } from './core/api/api-base-url.interceptor';
import { authInterceptor } from './core/auth/auth.interceptor';
import { TranslocoHttpLoader } from './core/i18n/transloco-loader';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // L'ordine conta: authInterceptor riconosce le richieste dal percorso relativo `/api/`
    provideHttpClient(withInterceptors([authInterceptor, apiBaseUrlInterceptor])),
    provideTransloco({
      config: {
        availableLangs: ['it', 'en'],
        defaultLang: 'it',
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
      },
      loader: TranslocoHttpLoader,
    }),
    // ECharts caricato in lazy: entra nel bundle solo dove serve un grafico
    provideEchartsCore({ echarts: () => import('echarts') }),
  ],
};
