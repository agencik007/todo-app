import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Injectable({
    providedIn: 'root',
})
export class LanguageService {
    private translate = inject(TranslateService);
    private platformId = inject(PLATFORM_ID);

    currentLang = signal<string>('en');

    constructor() {
        // Set available languages and default
        this.translate.addLangs(['en', 'pl']);
        this.translate.setFallbackLang('en');

        if (isPlatformBrowser(this.platformId)) {
            const savedLang = localStorage.getItem('lang');
            const browserLang = this.translate.getBrowserLang();
            const initialLang =
                savedLang ||
                (browserLang && browserLang.match(/en|pl/)
                    ? browserLang
                    : 'en');
            this.setLanguage(initialLang);
        } else {
            // On server, use english without making HTTP request
            this.translate.use('en').subscribe();
            this.currentLang.set('en');
        }
    }

    setLanguage(lang: string): void {
        // Subscribe to the observable to trigger the HTTP request
        this.translate.use(lang).subscribe({
            next: () => {
                this.currentLang.set(lang);
                if (isPlatformBrowser(this.platformId)) {
                    localStorage.setItem('lang', lang);
                    document.documentElement.lang = lang;
                }
            },
            error: (err) => {
                console.error(`Failed to load translations for ${lang}:`, err);
            },
        });
    }
}
