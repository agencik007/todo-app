import { definePreset } from '@primeuix/styled';
import Aura from '@primeuix/themes/aura';
import type { ColorPalette } from '../services/color.service';

// Ocean Depth - Professional cyan/teal colors
const oceanDepthPreset = definePreset(Aura, {
    semantic: {
        primary: {
            50: '{cyan.50}',
            100: '{cyan.100}',
            200: '{cyan.200}',
            300: '{cyan.300}',
            400: '{cyan.400}',
            500: '{cyan.500}',
            600: '{cyan.600}',
            700: '{cyan.700}',
            800: '{cyan.800}',
            900: '{cyan.900}',
            950: '{cyan.950}',
        },
    },
});

// Sunset Gradient - Warm orange colors
const sunsetGradientPreset = definePreset(Aura, {
    semantic: {
        primary: {
            50: '{orange.50}',
            100: '{orange.100}',
            200: '{orange.200}',
            300: '{orange.300}',
            400: '{orange.400}',
            500: '{orange.500}',
            600: '{orange.600}',
            700: '{orange.700}',
            800: '{orange.800}',
            900: '{orange.900}',
            950: '{orange.950}',
        },
    },
});

// Forest Night - Natural emerald/green colors
const forestNightPreset = definePreset(Aura, {
    semantic: {
        primary: {
            50: '{emerald.50}',
            100: '{emerald.100}',
            200: '{emerald.200}',
            300: '{emerald.300}',
            400: '{emerald.400}',
            500: '{emerald.500}',
            600: '{emerald.600}',
            700: '{emerald.700}',
            800: '{emerald.800}',
            900: '{emerald.900}',
            950: '{emerald.950}',
        },
    },
});

// Royal Purple - Elegant purple colors
const royalPurplePreset = definePreset(Aura, {
    semantic: {
        primary: {
            50: '{purple.50}',
            100: '{purple.100}',
            200: '{purple.200}',
            300: '{purple.300}',
            400: '{purple.400}',
            500: '{purple.500}',
            600: '{purple.600}',
            700: '{purple.700}',
            800: '{purple.800}',
            900: '{purple.900}',
            950: '{purple.950}',
        },
    },
});

// Cyberpunk - Neon pink colors
const cyberpunkPreset = definePreset(Aura, {
    semantic: {
        primary: {
            50: '{pink.50}',
            100: '{pink.100}',
            200: '{pink.200}',
            300: '{pink.300}',
            400: '{pink.400}',
            500: '{pink.500}',
            600: '{pink.600}',
            700: '{pink.700}',
            800: '{pink.800}',
            900: '{pink.900}',
            950: '{pink.950}',
        },
    },
});

export const THEME_PRESETS: Record<
    ColorPalette,
    ReturnType<typeof definePreset>
> = {
    'ocean-depth': oceanDepthPreset,
    'sunset-gradient': sunsetGradientPreset,
    'forest-night': forestNightPreset,
    'royal-purple': royalPurplePreset,
    cyberpunk: cyberpunkPreset,
};
