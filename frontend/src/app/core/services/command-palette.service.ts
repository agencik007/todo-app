import { isPlatformBrowser } from '@angular/common';
import {
    computed,
    effect,
    inject,
    Injectable,
    PLATFORM_ID,
    signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { TodoStore } from '../../features/todos/store/todo.store';
import { AuthStore } from '../store/auth.store';
import { ColorPalette, ColorService } from './color.service';
import { LanguageService } from './language.service';
import { ThemeMode, ThemeService } from './theme.service';

export type CommandCategory =
    | 'color'
    | 'theme'
    | 'language'
    | 'avatar'
    | 'account'
    | 'todo'
    | 'task_action';

export interface Command {
    id: string;
    labelKey: string; // Translation key
    descriptionKey?: string; // Translation key for description
    icon: string; // PrimeNG icon class
    category: CommandCategory;
    action: () => void;
    keyboardShortcut?: string;
    visible?: () => boolean; // Dynamic visibility based on state
    customLabel?: string; // For dynamic task labels
}

@Injectable({
    providedIn: 'root',
})
export class CommandPaletteService {
    private platformId = inject(PLATFORM_ID);
    private colorService = inject(ColorService);
    private themeService = inject(ThemeService);
    private languageService = inject(LanguageService);
    private authStore = inject(AuthStore);
    private todoStore = inject(TodoStore);
    private router = inject(Router);

    // State signals
    readonly isOpen = signal(false);

    // All available commands
    readonly commands = computed<Command[]>(() => {
        const isAuthenticated = this.authStore.isAuthenticated();
        const hasAvatar = !!this.authStore.userAvatar();

        return [
            // Color Palette Commands
            {
                id: 'color-ocean',
                labelKey: 'COMMAND_PALETTE.COMMANDS.COLOR_OCEAN',
                icon: 'pi pi-palette',
                category: 'color' as CommandCategory,
                action: (): void => this.changeColorPalette('ocean-depth'),
            },
            {
                id: 'color-sunset',
                labelKey: 'COMMAND_PALETTE.COMMANDS.COLOR_SUNSET',
                icon: 'pi pi-palette',
                category: 'color' as CommandCategory,
                action: (): void => this.changeColorPalette('sunset-gradient'),
            },
            {
                id: 'color-forest',
                labelKey: 'COMMAND_PALETTE.COMMANDS.COLOR_FOREST',
                icon: 'pi pi-palette',
                category: 'color' as CommandCategory,
                action: (): void => this.changeColorPalette('forest-night'),
            },
            {
                id: 'color-royal',
                labelKey: 'COMMAND_PALETTE.COMMANDS.COLOR_ROYAL',
                icon: 'pi pi-palette',
                category: 'color' as CommandCategory,
                action: (): void => this.changeColorPalette('royal-purple'),
            },
            {
                id: 'color-cyber',
                labelKey: 'COMMAND_PALETTE.COMMANDS.COLOR_CYBER',
                icon: 'pi pi-palette',
                category: 'color' as CommandCategory,
                action: (): void => this.changeColorPalette('cyberpunk'),
            },

            // Theme Commands
            {
                id: 'theme-light',
                labelKey: 'COMMAND_PALETTE.COMMANDS.THEME_LIGHT',
                icon: 'pi pi-sun',
                category: 'theme' as CommandCategory,
                action: (): void => this.changeTheme('light'),
            },
            {
                id: 'theme-dark',
                labelKey: 'COMMAND_PALETTE.COMMANDS.THEME_DARK',
                icon: 'pi pi-moon',
                category: 'theme' as CommandCategory,
                action: (): void => this.changeTheme('dark'),
            },
            {
                id: 'theme-system',
                labelKey: 'COMMAND_PALETTE.COMMANDS.THEME_SYSTEM',
                icon: 'pi pi-desktop',
                category: 'theme' as CommandCategory,
                action: (): void => this.changeTheme('system'),
            },

            // Language Commands
            {
                id: 'lang-en',
                labelKey: 'COMMAND_PALETTE.COMMANDS.LANG_EN',
                icon: 'pi pi-flag',
                category: 'language' as CommandCategory,
                action: (): void => this.changeLanguage('en'),
            },
            {
                id: 'lang-pl',
                labelKey: 'COMMAND_PALETTE.COMMANDS.LANG_PL',
                icon: 'pi pi-flag',
                category: 'language' as CommandCategory,
                action: (): void => this.changeLanguage('pl'),
            },

            // Avatar Commands (visible only when authenticated)
            {
                id: 'avatar-change',
                labelKey: 'COMMAND_PALETTE.COMMANDS.AVATAR_CHANGE',
                icon: 'pi pi-upload',
                category: 'avatar' as CommandCategory,
                action: (): void => this.changeAvatar(),
                visible: (): boolean => isAuthenticated,
            },
            {
                id: 'avatar-delete',
                labelKey: 'COMMAND_PALETTE.COMMANDS.AVATAR_DELETE',
                icon: 'pi pi-trash',
                category: 'avatar' as CommandCategory,
                action: (): void => this.deleteAvatar(),
                visible: (): boolean => isAuthenticated && hasAvatar,
            },

            // Account Commands
            {
                id: 'logout',
                labelKey: 'COMMAND_PALETTE.COMMANDS.LOGOUT',
                icon: 'pi pi-sign-out',
                category: 'account' as CommandCategory,
                action: (): void => this.logout(),
                visible: (): boolean => isAuthenticated,
            },

            // Todo Commands (visible only when authenticated)
            {
                id: 'todo-add',
                labelKey: 'COMMAND_PALETTE.COMMANDS.TODO_ADD',
                icon: 'pi pi-plus',
                category: 'todo' as CommandCategory,
                action: (): void => this.addTodo(),
                visible: (): boolean => isAuthenticated,
            },
        ].filter((cmd) => (cmd.visible ? cmd.visible() : true));
    });

    /**
     * Dynamically generates task-specific commands (Edit, Delete, Toggle)
     * based on search query and current tasks in TodoStore.
     */
    getTaskCommands(query: string): Command[] {
        const queryLower = query.toLowerCase().trim();
        if (!queryLower || !this.authStore.isAuthenticated()) return [];

        const tasks = this.todoStore
            .todos()
            .filter((t) => t.title.toLowerCase().includes(queryLower));

        const commands: Command[] = [];

        tasks.forEach((task) => {
            // Edit Command
            commands.push({
                id: `task-edit-${task.id}`,
                labelKey: 'COMMAND_PALETTE.COMMANDS.TASK_EDIT_DESC',
                customLabel: task.title,
                icon: 'pi pi-pencil',
                category: 'task_action' as CommandCategory,
                action: (): void => {
                    this.todoStore.showEditForm(task.id);
                    this.close();
                },
            });

            // Toggle Command
            commands.push({
                id: `task-toggle-${task.id}`,
                labelKey: task.completed
                    ? 'COMMAND_PALETTE.COMMANDS.TASK_UNDO_DESC'
                    : 'COMMAND_PALETTE.COMMANDS.TASK_DONE_DESC',
                customLabel: task.title,
                icon: task.completed ? 'pi pi-circle' : 'pi pi-check-circle',
                category: 'task_action' as CommandCategory,
                action: (): void => {
                    this.todoStore.toggleTodo(task);
                    this.close();
                },
            });

            // Delete Command
            commands.push({
                id: `task-delete-${task.id}`,
                labelKey: 'COMMAND_PALETTE.COMMANDS.TASK_DELETE_DESC',
                customLabel: task.title,
                icon: 'pi pi-trash',
                category: 'task_action' as CommandCategory,
                action: (): void => {
                    this.todoStore.deleteTodo(task.id);
                    this.close();
                },
            });
        });

        return commands;
    }

    constructor() {
        if (isPlatformBrowser(this.platformId)) {
            this.setupKeyboardShortcut();
        }
    }

    private setupKeyboardShortcut(): void {
        // Listen for Ctrl+K (or Cmd+K on Mac)
        effect(() => {
            const handleKeyDown = (event: KeyboardEvent): void => {
                if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
                    event.preventDefault();
                    this.toggle();
                }
            };

            window.addEventListener('keydown', handleKeyDown);

            // Cleanup is handled automatically by Angular effects
        });
    }

    open(): void {
        this.isOpen.set(true);
    }

    close(): void {
        this.isOpen.set(false);
    }

    toggle(): void {
        this.isOpen.set(!this.isOpen());
    }

    // ==================== Command Actions ====================

    private changeColorPalette(palette: ColorPalette): void {
        this.colorService.setColorPalette(palette);
        this.close();
    }

    private changeTheme(theme: ThemeMode): void {
        this.themeService.setMode(theme);
        this.close();
    }

    private changeLanguage(lang: string): void {
        this.languageService.setLanguage(lang);
        this.authStore.syncLanguage(lang);
        this.close();
    }

    private changeAvatar(): void {
        if (isPlatformBrowser(this.platformId)) {
            // Trigger file upload input
            const fileInput = document.getElementById(
                'avatarInput',
            ) as HTMLInputElement;
            if (fileInput) {
                fileInput.click();
            }
        }
        this.close();
    }

    private deleteAvatar(): void {
        // This will be handled by auth-nav component
        // We'll dispatch a custom event
        if (isPlatformBrowser(this.platformId)) {
            window.dispatchEvent(new CustomEvent('delete-avatar-command'));
        }
        this.close();
    }

    private logout(): void {
        this.authStore.clearUser();
        this.router.navigate(['/login']);
        this.close();
    }

    private addTodo(): void {
        this.todoStore.showCreateForm();
        this.close();
    }
}
