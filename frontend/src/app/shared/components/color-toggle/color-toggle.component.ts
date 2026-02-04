import { Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';
import {
    ColorService,
    type ColorPalette,
} from '../../../core/services/color.service';

interface PaletteOption {
    id: ColorPalette;
    icon: string;
    translationKey: string;
}

@Component({
    selector: 'app-color-toggle',
    imports: [TranslatePipe, ButtonModule, Tooltip],
    templateUrl: './color-toggle.component.html',
    styleUrl: './color-toggle.component.scss',
})
export class ColorToggleComponent {
    // 1. Injects (readonly #private)
    readonly #colorService = inject(ColorService);

    // 2. Static constants
    // (None)

    // 3. Decorators input()
    // (None)

    // 4. Decorators output()
    // (None)

    // 5. Decorators viewChild/viewChildren
    // (None)

    // 6. Signals (always readonly)
    // (None)

    // 7. Readonly variables
    // (None)

    // 8. Private variables (use # prefix)
    // (None)

    // 9. Public variables
    public readonly palettes: PaletteOption[] = [
        { id: 'ocean-depth', icon: 'pi-cloud', translationKey: 'OCEAN_DEPTH' },
        {
            id: 'sunset-gradient',
            icon: 'pi-sun',
            translationKey: 'SUNSET_GRADIENT',
        },
        {
            id: 'forest-night',
            icon: 'pi-prime',
            translationKey: 'FOREST_NIGHT',
        },
        {
            id: 'royal-purple',
            icon: 'pi-crown',
            translationKey: 'ROYAL_PURPLE',
        },
        { id: 'cyberpunk', icon: 'pi-bolt', translationKey: 'CYBERPUNK' },
    ];

    // 10. Constructor
    // (None)

    // 11. Lifecycle methods
    // (None)

    // 12. Private methods (use # prefix)
    // (None)

    // 13. Public methods
    // (None)

    // 14. Event handlers (use 'on' prefix)
    onSetPalette(palette: ColorPalette): void {
        this.#colorService.setColorPalette(palette);
    }

    // 15. Getters and Setters
    get currentPalette(): ColorPalette {
        return this.#colorService.colorPalette();
    }
}
