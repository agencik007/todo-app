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
import { provideApi } from '@api/index';
import { TranslateModule } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import Aura from '@primeuix/themes/aura';
import { MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { notificationInterceptor } from './core/interceptors/notification.interceptor';
import { LanguageService } from './core/services/language.service';
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

export const appConfig: ApplicationConfig = {
    providers: [
        provideBrowserGlobalErrorListeners(),
        provideZoneChangeDetection({ eventCoalescing: true }),
        provideRouter(routes),
        provideClientHydration(),
        provideHttpClient(
            withInterceptors([notificationInterceptor, authInterceptor]),
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
            suffix: '.json',
        }),
        provideAppInitializer(initializeLanguage),
        provideAppInitializer(initializeApp),
        MessageService,
        providePrimeNG({
            theme: {
                preset: Aura,
                options: {
                    darkModeSelector: '.dark',
                    // Emits PrimeNG's theme into a `primeng` CSS layer. The order
                    // must match the @layer declaration in src/tailwind.css so that
                    // Tailwind utilities can override PrimeNG component styles.
                    cssLayer: {
                        name: 'primeng',
                        order: 'theme, base, primeng, components, utilities',
                    },
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
