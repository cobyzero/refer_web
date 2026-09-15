import { ApplicationConfig, provideBrowserGlobalErrorListeners, inject, provideAppInitializer } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { authInterceptor } from './core/interceptors/auth';
import { ConfigService } from './core/services/config';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([authInterceptor])
    ),
    // Preload operator settings (currency) before first paint; never blocks boot.
    provideAppInitializer(() => {
      const config = inject(ConfigService);
      return firstValueFrom(config.load());
    }),
  ],
};
