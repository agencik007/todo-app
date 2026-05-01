import { Component, computed, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { MenuItem } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';
import { MenubarModule } from 'primeng/menubar';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { filter, startWith } from 'rxjs';
import { CommandPaletteService } from 'src/app/core/services/command-palette.service';
import { LanguageService } from 'src/app/core/services/language.service';
import { ScreenSizeService } from 'src/app/core/services/screen-size.service';
import { SidebarService } from 'src/app/core/services/sidebar.service';
import { AuthStore } from 'src/app/core/store/auth.store';
import { WeatherWidgetComponent } from '../../../../shared/components/weather-widget/weather-widget.component';
import { UserProfileComponent } from '../user-profile/user-profile';

@Component({
    selector: 'app-auth-nav',
    imports: [
        RouterModule,
        MenubarModule,
        ButtonModule,
        ProgressSpinnerModule,
        MenuModule,
        TranslatePipe,
        UserProfileComponent,
        WeatherWidgetComponent,
    ],
    templateUrl: './auth-nav.html',
    styleUrl: './auth-nav.scss',
})
export class AuthNavComponent {
    // 1. Injects (readonly private)
    private readonly authStore = inject(AuthStore);
    private readonly router = inject(Router);
    private readonly languageService = inject(LanguageService);
    private readonly screenSize = inject(ScreenSizeService);
    private readonly commandPaletteService = inject(CommandPaletteService);
    private readonly sidebarService = inject(SidebarService);

    // 6. Signals (always readonly)
    readonly isAuthenticated = this.authStore.isAuthenticated;
    readonly isLoading = this.authStore.isLoading;
    readonly isInitialized = this.authStore.isInitialized;

    readonly #currentUrl = signal(this.router.url);

    constructor() {
        this.router.events
            .pipe(
                filter((event) => event instanceof NavigationEnd),
                startWith(null),
            )
            .subscribe(() => {
                this.#currentUrl.set(this.router.url);
            });

        effect(() => {
            if (this.isAuthPage()) {
                this.languageService.setAuthPageLanguage();
            }
        });
    }

    // Defer signal access to computed to ensure services are fully initialized
    readonly isCompact = computed(() => this.screenSize.isCompact());
    readonly isMobile = computed(() => this.screenSize.isMobile());
    readonly isAuthPage = computed(() => {
        const url = this.#currentUrl();
        return url.includes('/login') || url.includes('/register');
    });

    readonly guestMenuItems = computed<MenuItem[]>(() => {
        // Trigger re-computation on language change
        this.languageService.currentLang();

        return [
            {
                label: 'Login', // Will be translated in template or here
                icon: 'pi pi-sign-in',
                routerLink: '/login',
            },
            {
                label: 'Register',
                icon: 'pi pi-user-plus',
                routerLink: '/register',
            },
        ];
    });

    // 14. Event handlers (use 'on' prefix)
    onOpenCommandPalette(): void {
        this.commandPaletteService.open();
    }

    onToggleSidebar(): void {
        this.sidebarService.toggleMobile();
    }
}
