import { ApplicationConfig, isDevMode, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { MatDatepickerIntl } from '@angular/material/datepicker';
import { provideTransloco } from '@jsverse/transloco';
import { provideEchartsCore } from 'ngx-echarts';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { TranslocoDatepickerIntl } from './core/i18n/transloco-datepicker-intl';
import { TranslocoHttpLoader } from './core/i18n/transloco-loader';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideTransloco({
      config: {
        availableLangs: ['it', 'en'],
        defaultLang: 'it',
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
      },
      loader: TranslocoHttpLoader,
    }),
    // etichette del calendario Material nella lingua attiva
    { provide: MatDatepickerIntl, useClass: TranslocoDatepickerIntl },
    // ECharts caricato in lazy: entra nel bundle solo dove serve un grafico
    provideEchartsCore({ echarts: () => import('echarts') }),
  ],
};
