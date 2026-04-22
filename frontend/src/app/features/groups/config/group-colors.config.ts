import { GroupColor } from '@api';

export interface GroupColorConfig {
    hex: string;
    cssClass: string;
    label: string;
}

export const GROUP_COLOR_MAP: Record<string, GroupColorConfig> = {
    [GroupColor.Blue]: {
        hex: '#3B82F6',
        cssClass: 'group-color-blue',
        label: 'COLORS.BLUE',
    },
    [GroupColor.Green]: {
        hex: '#10B981',
        cssClass: 'group-color-green',
        label: 'COLORS.GREEN',
    },
    [GroupColor.Red]: {
        hex: '#EF4444',
        cssClass: 'group-color-red',
        label: 'COLORS.RED',
    },
    [GroupColor.Yellow]: {
        hex: '#F59E0B',
        cssClass: 'group-color-yellow',
        label: 'COLORS.YELLOW',
    },
    [GroupColor.Purple]: {
        hex: '#8B5CF6',
        cssClass: 'group-color-purple',
        label: 'COLORS.PURPLE',
    },
    [GroupColor.Pink]: {
        hex: '#EC4899',
        cssClass: 'group-color-pink',
        label: 'COLORS.PINK',
    },
    [GroupColor.Orange]: {
        hex: '#F97316',
        cssClass: 'group-color-orange',
        label: 'COLORS.ORANGE',
    },
    [GroupColor.Teal]: {
        hex: '#14B8A6',
        cssClass: 'group-color-teal',
        label: 'COLORS.TEAL',
    },
    [GroupColor.Indigo]: {
        hex: '#6366F1',
        cssClass: 'group-color-indigo',
        label: 'COLORS.INDIGO',
    },
    [GroupColor.Gray]: {
        hex: '#6B7280',
        cssClass: 'group-color-gray',
        label: 'COLORS.GRAY',
    },
};

/**
 * Returns color configuration for a given group color.
 * Falls back to Blue if color not found.
 */
export function getGroupColorConfig(color: string): GroupColorConfig {
    return GROUP_COLOR_MAP[color] || GROUP_COLOR_MAP[GroupColor.Blue];
}

/**
 * Returns all available group colors for color picker.
 */
export function getAllGroupColors(): {
    color: string;
    config: GroupColorConfig;
}[] {
    return Object.entries(GROUP_COLOR_MAP).map(([color, config]) => ({
        color,
        config,
    }));
}
