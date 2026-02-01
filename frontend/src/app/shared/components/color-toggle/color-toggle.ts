import { Component, inject } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
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
    imports: [TranslateModule],
    template: `
        <div class="color-toggle">
            @for (palette of palettes; track palette.id) {
                <button
                    type="button"
                    class="color-toggle-btn"
                    [title]="
                        'COLOR_PALETTES.' + palette.translationKey | translate
                    "
                    [class.active]="colorService.colorPalette() === palette.id"
                    [attr.aria-label]="
                        'COLOR_PALETTES.' + palette.translationKey | translate
                    "
                    (click)="setPalette(palette.id)"
                >
                    <i [class]="'pi ' + palette.icon"></i>
                </button>
            }
        </div>
    `,
    styles: [
        `
            .color-toggle {
                display: flex;
                gap: 0.5rem;
                align-items: center;
            }

            .color-toggle-btn {
                width: 1.5rem;
                height: 1.5rem;
                border-radius: 50%;
                border: 2px solid transparent;
                background: var(--p-surface-100);
                color: var(--p-text-color);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s ease;
                font-size: 1.1rem;
            }

            .color-toggle-btn:hover {
                background: var(--p-surface-200);
                transform: scale(1.1);
            }

            .color-toggle-btn.active {
                border-color: var(--p-primary-color);
                background: var(--p-primary-color);
                color: var(--p-primary-contrast-color);
            }

            .color-toggle-btn:focus-visible {
                outline: 2px solid var(--p-primary-color);
                outline-offset: 2px;
            }

            /* Ocean Depth - Cyan */
            .color-toggle-btn:nth-child(1):not(.active) {
                color: #0891b2;
            }

            /* Sunset Gradient - Orange */
            .color-toggle-btn:nth-child(2):not(.active) {
                color: #f97316;
            }

            /* Forest Night - Emerald */
            .color-toggle-btn:nth-child(3):not(.active) {
                color: #059669;
            }

            /* Royal Purple - Purple */
            .color-toggle-btn:nth-child(4):not(.active) {
                color: #9333ea;
            }

            /* Cyberpunk - Pink */
            .color-toggle-btn:nth-child(5):not(.active) {
                color: #ec4899;
            }

            .dark {
                .color-toggle-btn {
                    background: var(--p-surface-800);
                }

                .color-toggle-btn:hover {
                    background: var(--p-surface-700);
                }
            }
        `,
    ],
})
export class ColorToggleComponent {
    protected colorService = inject(ColorService);

    protected palettes: PaletteOption[] = [
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

    setPalette(palette: ColorPalette): void {
        this.colorService.setColorPalette(palette);
    }
}
