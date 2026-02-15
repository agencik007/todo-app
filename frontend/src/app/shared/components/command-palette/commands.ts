import { CommandCategory } from '../../../core/services/command-palette.service';

export const BASE_COMMANDS_CONFIG = [
    // Theme Commands
    {
        id: 'theme-light',
        labelKey: 'COMMAND_PALETTE.COMMANDS.THEME_LIGHT',
        icon: 'pi pi-sun',
        category: 'theme' as CommandCategory,
    },
    {
        id: 'theme-dark',
        labelKey: 'COMMAND_PALETTE.COMMANDS.THEME_DARK',
        icon: 'pi pi-moon',
        category: 'theme' as CommandCategory,
    },
    {
        id: 'theme-system',
        labelKey: 'COMMAND_PALETTE.COMMANDS.THEME_SYSTEM',
        icon: 'pi pi-desktop',
        category: 'theme' as CommandCategory,
    },
    {
        id: 'theme-snow-toggle',
        labelKey: 'COMMAND_PALETTE.COMMANDS.THEME_SNOW_TOGGLE',
        icon: 'pi pi-cloud',
        category: 'theme' as CommandCategory,
    },

    // Color Palette Commands
    {
        id: 'color-ocean',
        labelKey: 'COMMAND_PALETTE.COMMANDS.COLOR_OCEAN',
        icon: 'pi pi-palette',
        category: 'color' as CommandCategory,
    },
    {
        id: 'color-sunset',
        labelKey: 'COMMAND_PALETTE.COMMANDS.COLOR_SUNSET',
        icon: 'pi pi-palette',
        category: 'color' as CommandCategory,
    },
    {
        id: 'color-forest',
        labelKey: 'COMMAND_PALETTE.COMMANDS.COLOR_FOREST',
        icon: 'pi pi-palette',
        category: 'color' as CommandCategory,
    },
    {
        id: 'color-royal',
        labelKey: 'COMMAND_PALETTE.COMMANDS.COLOR_ROYAL',
        icon: 'pi pi-palette',
        category: 'color' as CommandCategory,
    },
    {
        id: 'color-cyber',
        labelKey: 'COMMAND_PALETTE.COMMANDS.COLOR_CYBER',
        icon: 'pi pi-palette',
        category: 'color' as CommandCategory,
    },

    // Language Commands
    {
        id: 'lang-en',
        labelKey: 'COMMAND_PALETTE.COMMANDS.LANG_EN',
        icon: 'pi pi-flag',
        category: 'language' as CommandCategory,
    },
    {
        id: 'lang-pl',
        labelKey: 'COMMAND_PALETTE.COMMANDS.LANG_PL',
        icon: 'pi pi-flag',
        category: 'language' as CommandCategory,
    },

    // Avatar Commands
    {
        id: 'avatar-change',
        labelKey: 'COMMAND_PALETTE.COMMANDS.AVATAR_CHANGE',
        icon: 'pi pi-upload',
        category: 'avatar' as CommandCategory,
    },
    {
        id: 'avatar-delete',
        labelKey: 'COMMAND_PALETTE.COMMANDS.AVATAR_DELETE',
        icon: 'pi pi-trash',
        category: 'avatar' as CommandCategory,
    },

    // Account Commands
    {
        id: 'logout',
        labelKey: 'COMMAND_PALETTE.COMMANDS.LOGOUT',
        icon: 'pi pi-sign-out',
        category: 'account' as CommandCategory,
    },

    // Todo Commands
    {
        id: 'todo-add',
        labelKey: 'COMMAND_PALETTE.COMMANDS.TODO_ADD',
        icon: 'pi pi-plus',
        category: 'todo' as CommandCategory,
    },

    // Group Commands
    {
        id: 'group-add-static',
        labelKey: 'COMMAND_PALETTE.COMMANDS.GROUP_ADD',
        icon: 'pi pi-plus-circle',
        category: 'group' as CommandCategory,
    },
];
