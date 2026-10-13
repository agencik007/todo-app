import { Component, computed, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { MenubarModule } from 'primeng/menubar';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { filter, startWith } from 'rxjs';
import { CommandPaletteService } from 'src/app/core/services/command-palette.service';
import { LanguageService } from 'src/app/core/services/language.service';
import { ScreenSizeService } from 'src/app/core/services/screen-size.service';
import { SidebarService } from 'src/app/core/services/sidebar.service';
import { AuthStore } from 'src/app/core/store/auth.store';
import { LanguageSelectorComponent } from '../../../../shared/components/language-selector/language-selector.component';
import { WeatherWidgetComponent } from '../../../../shared/components/weather-widget/weather-widget.component';
import { UserProfileComponent } from '../user-profile/user-profile';

@Component({
  selector: 'app-auth-nav',
  imports: [
    RouterModule,
    MenubarModule,
    ButtonModule,
    ProgressSpinnerModule,
    TranslatePipe,
    LanguageSelectorComponent,
    UserProfileComponent,
    WeatherWidgetComponent,
  ],
  templateUrl: './auth-nav.html',
  styleUrl: './auth-nav.scss',
})
export class AuthNavComponent {
  // 1. Injects (readonly #private)
  readonly #authStore = inject(AuthStore);
  readonly #router = inject(Router);
  readonly #languageService = inject(LanguageService);
  readonly #screenSize = inject(ScreenSizeService);
  readonly #commandPaletteService = inject(CommandPaletteService);
  readonly #sidebarService = inject(SidebarService);

  // 6. Signals (always readonly)
  readonly isAuthenticated = this.#authStore.isAuthenticated;
  readonly isLoading = this.#authStore.isLoading;
  readonly isInitialized = this.#authStore.isInitialized;

  readonly #currentPath = signal(this.#pathOf(this.#router.url));

  readonly isCompact = computed(() => this.#screenSize.isCompact());
  readonly isMobile = computed(() => this.#screenSize.isMobile());
  readonly isLoginPage = computed(() => this.#currentPath() === '/login');
  readonly isRegisterPage = computed(() => this.#currentPath() === '/register');

  // 10. Constructor
  constructor() {
    this.#router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        startWith(null),
      )
      .subscribe(() => {
        this.#currentPath.set(this.#pathOf(this.#router.url));
      });

    effect(() => {
      if (this.isLoginPage() || this.isRegisterPage()) {
        this.#languageService.setAuthPageLanguage();
      }
    });
  }

  // 12. Private methods
  #pathOf(url: string): string {
    return url.split(/[?#]/)[0];
  }

  // 14. Event handlers (use 'on' prefix)
  onOpenCommandPalette(): void {
    this.#commandPaletteService.open();
  }

  onToggleSidebar(): void {
    this.#sidebarService.toggleMobile();
  }
}
