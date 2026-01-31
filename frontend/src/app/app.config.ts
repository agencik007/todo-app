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
import { AuthStateService } from './core/services/auth-state.service';
import { LanguageService } from './core/services/language.service';

function initializeLanguage(): Promise<void> {
    inject(LanguageService);
    // Eagerly initialize language service
    return Promise.resolve();
}

function initializeApp(): Promise<void> {
    const authStateService = inject(AuthStateService);
    return authStateService.initializeAuth();
}

export const appConfig: ApplicationConfig = {
    providers: [
        provideBrowserGlobalErrorListeners(),
        provideZoneChangeDetection({ eventCoalescing: true }),
        provideRouter(routes),
        provideClientHydration(),
        provideHttpClient(withInterceptors([authInterceptor]), withFetch()),
        provideApi(environment.apiUrl),
        importProvidersFrom(
            TranslateModule.forRoot({
                fallbackLang: 'pl',
            }),
        ),
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
                },
            },
        }),
    ],
};
