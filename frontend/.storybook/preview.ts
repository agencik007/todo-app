import { setCompodocJson } from '@storybook/addon-docs/angular';
import { type Decorator, type Preview } from '@storybook/angular-vite';
import { providePrimeNG } from 'primeng/config';
import {
    FORCE_REMOUNT,
    GLOBALS_UPDATED,
} from 'storybook/internal/core-events';
import { addons } from 'storybook/preview-api';
import { THEME_PRESETS } from '../src/app/core/config/theme-presets';
import type { ColorPalette } from '../src/app/core/services/color.service';
import docJson from '../documentation.json';

// Globalne style aplikacji (tokeny --app-*, utility, style prymitywów).
// Framework vite'owy nie czyta "styles" z angular.json, więc import jawny.
import '../src/styles.scss';

setCompodocJson(docJson);

// Toolbar: tryb jasny/ciemny + 5 palet aplikacji. Preset palety podajemy
// w applicationConfig KAŻDEGO renderu (jak w app.config.ts, tylko z gotowym
// presetem z theme-presets.ts zamiast bazowej Aury + updatePreset) — dzięki
// temu bootstrap story nie nadpisuje wybranej palety.
// Zmiana globali sama z siebie nie niszczy aplikacji Angulara — bez remountu
// nowy preset palety z applicationConfig nigdy by się nie zaaplikował.
let lastStoryId: string | undefined;
const channel = addons.getChannel();
channel.on(GLOBALS_UPDATED, () => {
    if (lastStoryId) {
        channel.emit(FORCE_REMOUNT, { storyId: lastStoryId });
    }
});

const withAppTheme: Decorator = (story, context) => {
    const { theme, palette } = context.globals;
    lastStoryId = context.id;
    document.documentElement.classList.toggle('dark', theme === 'dark');

    const rendered = story();
    return {
        ...rendered,
        applicationConfig: {
            ...rendered.applicationConfig,
            providers: [
                ...(rendered.applicationConfig?.providers ?? []),
                providePrimeNG({
                    theme: {
                        preset: THEME_PRESETS[palette as ColorPalette],
                        options: { darkModeSelector: '.dark' },
                    },
                }),
            ],
        },
    };
};

const preview: Preview = {
    decorators: [withAppTheme],

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
