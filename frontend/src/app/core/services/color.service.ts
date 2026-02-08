import { isPlatformBrowser } from '@angular/common';
import { effect, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { updatePreset } from '@primeuix/styled';
import { THEME_PRESETS } from '../config/theme-presets';

export type ColorPalette =
    | 'ocean-depth'
    | 'sunset-gradient'
    | 'forest-night'
    | 'royal-purple'
    | 'cyberpunk';

@Injectable({
    providedIn: 'root',
})
export class ColorService {
    private platformId = inject(PLATFORM_ID);

    // Current active color palette
    readonly colorPalette = signal<ColorPalette>('ocean-depth');

    constructor() {
        if (isPlatformBrowser(this.platformId)) {
            const savedPalette = localStorage.getItem(
                'color-palette',
            ) as ColorPalette;
            if (savedPalette && this.isValidPalette(savedPalette)) {
                this.colorPalette.set(savedPalette);
            }

            // Apply palette on changes (including initial load)
            effect(() => {
                const currentPalette = this.colorPalette();
                this.applyPalette(currentPalette);
            });
        }
    }

    setColorPalette(palette: ColorPalette): void {
        this.colorPalette.set(palette);
        if (isPlatformBrowser(this.platformId)) {
            localStorage.setItem('color-palette', palette);
        }
    }

    private isValidPalette(value: string): value is ColorPalette {
        return [
            'ocean-depth',
            'sunset-gradient',
            'forest-night',
            'royal-purple',
            'cyberpunk',
        ].includes(value);
    }

    private applyPalette(palette: ColorPalette): void {
        if (!isPlatformBrowser(this.platformId)) return;

        // Set data attribute on document element for CSS targeting
        document.documentElement.setAttribute('data-color-palette', palette);

        // Update PrimeNG theme preset
        updatePreset(THEME_PRESETS[palette]);
    }
}
