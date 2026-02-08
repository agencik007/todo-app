import { Component, computed, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Tooltip } from 'primeng/tooltip';
import { LanguageService } from '../../../core/services/language.service';
import { ThemeMode, ThemeService } from '../../../core/services/theme.service';

@Component({
    selector: 'app-theme-toggle',
    imports: [Tooltip],
    templateUrl: './theme-toggle.component.html',
    styleUrl: './theme-toggle.component.scss',
})
export class ThemeToggleComponent {
    // 1. Injects (readonly #private)
    readonly #themeService = inject(ThemeService);
    readonly #translateService = inject(TranslateService);
    readonly #languageService = inject(LanguageService);

    // 2. Static constants
    private static readonly THEME_OPTIONS_CONFIG: {
        mode: ThemeMode;
        icon: string;
        translationKey: string;
        class: string;
    }[] = [
        {
            mode: 'light',
            icon: 'pi-sun',
            translationKey: 'THEME.LIGHT',
            class: 'sun',
        },
        {
            mode: 'system',
            icon: 'pi-desktop',
            translationKey: 'THEME.SYSTEM',
            class: 'system',
        },
        {
            mode: 'dark',
            icon: 'pi-moon',
            translationKey: 'THEME.DARK',
            class: 'moon',
        },
    ];

    // 3. Decorators input()
    // (None)

    // 4. Decorators output()
    // (None)

    // 5. Decorators viewChild/viewChildren
    // (None)

    // 6. Signals (always readonly)
    readonly mode = this.#themeService.mode;

    readonly themeOptions = computed(() => {
        // Access currentLang to trigger re-computation when language changes
        this.#languageService.currentLang();

        return ThemeToggleComponent.THEME_OPTIONS_CONFIG.map((option) => ({
            ...option,
            tooltip: this.#translateService.instant(option.translationKey),
        }));
    });

    // 7. Readonly variables
    // (None)

    // 8. Private variables (use # prefix)
    // (None)

    // 9. Public variables
    // (None)

    // 10. Constructor
    // (None)

    // 11. Lifecycle methods
    // (None)

    // 12. Private methods (use # prefix)
    // (None)

    // 13. Public methods
    // (None)

    // 14. Event handlers (use 'on' prefix)
    onSetMode(mode: ThemeMode): void {
        this.#themeService.setMode(mode);
    }

    onNextMode(): void {
        const current = this.#themeService.mode();
        const modes = ThemeToggleComponent.THEME_OPTIONS_CONFIG.map(
            (o) => o.mode,
        );
        const currentIndex = modes.indexOf(current);
        const nextIndex = (currentIndex + 1) % modes.length;
        this.onSetMode(modes[nextIndex]);
    }

    // 15. Getters and Setters
    // (None)
}
