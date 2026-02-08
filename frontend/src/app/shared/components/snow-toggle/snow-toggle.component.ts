import { Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';
import { SnowService } from '../../../core/services/snow.service';

@Component({
    selector: 'app-snow-toggle',
    imports: [TranslatePipe, ButtonModule, Tooltip],
    templateUrl: './snow-toggle.component.html',
    styleUrl: './snow-toggle.component.scss',
})
export class SnowToggleComponent {
    // 1. Injects (readonly #private)
    readonly #snowService = inject(SnowService);

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
    onToggleSnow(): void {
        this.#snowService.toggle();
    }

    // 15. Getters and Setters
    // (None)
}
