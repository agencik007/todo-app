import { updatePreset } from '@primeuix/styled';
import Aura from '@primeuix/themes/aura';
import { setCompodocJson } from '@storybook/addon-docs/angular';
import {
    applicationConfig,
    type Decorator,
    type Preview,
} from '@storybook/angular-vite';
import { providePrimeNG } from 'primeng/config';
import { THEME_PRESETS } from '../src/app/core/config/theme-presets';
import type { ColorPalette } from '../src/app/core/services/color.service';
import docJson from '../documentation.json';

setCompodocJson(docJson);

// Toolbar: tryb jasny/ciemny + 5 palet aplikacji
const withAppTheme: Decorator = (story, context) => {
    const { theme, palette } = context.globals;
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
        updatePreset(THEME_PRESETS[palette as ColorPalette]);
    } catch {
        // Przed pierwszym bootstrapem Angulara motyw jeszcze nie
        // istnieje — paleta zaaplikuje się przy kolejnej zmianie.
    }
    return story();
};

const preview: Preview = {
    decorators: [
        // Ta sama konfiguracja motywu co w app.config.ts
        applicationConfig({
            providers: [
                providePrimeNG({
                    theme: {
                        preset: Aura,
                        options: { darkModeSelector: '.dark' },
                    },
                }),
            ],
        }),
        withAppTheme,
    ],

    globalTypes: {
        theme: {
            description: 'Tryb jasny/ciemny (klasa .dark)',
            toolbar: {
                title: 'Motyw',
                icon: 'mirror',
                items: [
                    { value: 'light', title: 'Jasny', icon: 'sun' },
                    { value: 'dark', title: 'Ciemny', icon: 'moon' },
                ],
                dynamicTitle: true,
            },
        },
        palette: {
            description: 'Paleta kolorów (presety PrimeUIX z theme-presets.ts)',
            toolbar: {
                title: 'Paleta',
                icon: 'paintbrush',
                items: [
                    { value: 'ocean-depth', title: 'Ocean Depth (cyjan)' },
                    { value: 'sunset-gradient', title: 'Sunset (pomarańcz)' },
                    { value: 'forest-night', title: 'Forest (szmaragd)' },
                    { value: 'royal-purple', title: 'Royal (fiolet)' },
                    { value: 'cyberpunk', title: 'Cyberpunk (róż)' },
                ],
                dynamicTitle: true,
            },
        },
    },

    initialGlobals: {
        theme: 'light',
        palette: 'ocean-depth',
    },

    parameters: {
        // Tłem steruje motyw (surface-ground + .dark), nie addon backgrounds
        backgrounds: { disable: true },

        controls: {
            matchers: {
                color: /(background|color)$/i,
                date: /Date$/i,
            },
        },

        a11y: {
            // 'todo' - show a11y violations in the test UI only
            // 'error' - fail CI on a11y violations
            // 'off' - skip a11y checks entirely
            test: 'todo',
        },
    },
};

export default preview;
