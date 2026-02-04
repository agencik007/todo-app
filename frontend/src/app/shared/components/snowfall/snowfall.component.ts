import { Component, inject } from '@angular/core';
import { SnowService } from '../../../core/services/snow.service';
import { ThemeService } from '../../../core/services/theme.service';

@Component({
    selector: 'app-snowfall',
    imports: [],
    templateUrl: './snowfall.component.html',
    styleUrl: './snowfall.component.scss',
})
export class SnowfallComponent {
    // 1. Injects (readonly #private)
    readonly #snowService = inject(SnowService);
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
    readonly isSnowing = this.#snowService.isEnabled;
    readonly isDark = this.#themeService.isDark;

    // 7. Readonly variables
    // Generate a fixed number of flakes with random properties
    readonly flakes = Array.from({ length: 50 }).map(() => ({
        left: Math.random() * 100,
        delay: Math.random() * 10,
        duration: 5 + Math.random() * 10,
        opacity: 0.3 + Math.random() * 0.7,
        size: 10 + Math.random() * 20,
    }));

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
    // (None)

    // 15. Getters and Setters
    // (None)
}
