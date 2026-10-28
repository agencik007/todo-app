import { IMAGE_CONFIG } from '@angular/common';
import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import {
  ApplicationConfig,
  importProvidersFrom,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideClientHydration } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { provideApi } from '@api/index';
import { TranslateModule } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import Aura from '@primeuix/themes/aura';
import { MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { patchPrimeNgAutofocus } from './core/config/primeng-autofocus.patch';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { notificationInterceptor } from './core/interceptors/notification.interceptor';
import { serviceWorkerBypassInterceptor } from './core/interceptors/service-worker-bypass.interceptor';
import { AppUpdateService } from './core/services/app-update.service';
import { LanguageService } from './core/services/language.service';
import { PwaInstallService } from './core/services/pwa-install.service';
import { AuthStore } from './core/store/auth.store';
import { API_URL } from './core/tokens/api-url.token';

function initializeLanguage(): Promise<void> {
  const languageService = inject(LanguageService);
  return languageService.init();
}

function initializeApp(): Promise<void> {
  const authStore = inject(AuthStore);
  return authStore.initializeAuth();
}

function initializeAppUpdates(): void {
  inject(AppUpdateService).init();
}

function initializePwaInstall(): void {
  inject(PwaInstallService).init();
}

patchPrimeNgAutofocus();

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideClientHydration(),
    provideHttpClient(
      withInterceptors([
        notificationInterceptor,
        authInterceptor,
        serviceWorkerBypassInterceptor,
      ]),
      withFetch(),
    ),
    provideApi(environment.apiUrl),
    {
      provide: API_URL,
      useValue: environment.apiUrl,
    },
    importProvidersFrom(TranslateModule.forRoot()),
    provideTranslateHttpLoader({
      prefix: './assets/i18n/',
      // The query string busts translations that browsers cached for a year
      // before server.ts started sending `Cache-Control: no-cache` for them.
      suffix: '.json?v=2',
    }),
    provideAppInitializer(initializeLanguage),
    provideAppInitializer(initializeApp),
    provideServiceWorker('ngsw-worker.js', {
      enabled: environment.serviceWorker,
      // Register once the app is stable (at most 30 s after boot), so the
      // service worker's prefetch doesn't compete with the first render.
      registrationStrategy: 'registerWhenStable:30000',
    }),
    provideAppInitializer(initializeAppUpdates),
    provideAppInitializer(initializePwaInstall),
    MessageService,
    providePrimeNG({
      theme: {
        preset: Aura,
        options: {
          darkModeSelector: '.dark',
        },
      },
      zIndex: {
        modal: 1100,
        overlay: 3000,
        menu: 3000,
        tooltip: 3100,
      },
    }),
    {
      provide: IMAGE_CONFIG,
      useValue: {
        disableImageSizeWarning: true,
        disableImageLazyLoadWarning: true,
      },
    },
  ],
};
