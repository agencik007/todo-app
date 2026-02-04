import { Component, inject } from '@angular/core';
import { Tooltip } from 'primeng/tooltip';
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

    // 2. Static constants
    // (None)

    // 3. Decorators input()
    // (None)

    // 4. Decorators output()
    // (None)

    // 5. Decorators viewChild/viewChildren
    // (None)

    // 6. Signals (always readonly)
    readonly mode = this.#themeService.mode;

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
        const modes: ThemeMode[] = ['light', 'system', 'dark'];
        const currentIndex = modes.indexOf(current);
        const nextIndex = (currentIndex + 1) % modes.length;
        this.onSetMode(modes[nextIndex]);
    }

    // 15. Getters and Setters
    // (None)
}
