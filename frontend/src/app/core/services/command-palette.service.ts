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
import { GroupStore } from '../../features/groups/store/group.store';
import { TodoStore } from '../../features/todos/store/todo.store';
import { BASE_COMMANDS_CONFIG } from '../../shared/components/command-palette/commands';
import { AuthStore } from '../store/auth.store';
import { ColorPalette, ColorService } from './color.service';
import { LanguageService } from './language.service';
import { SnowService } from './snow.service';
import { ThemeMode, ThemeService } from './theme.service';

export type CommandCategory =
    | 'color'
    | 'theme'
    | 'language'
    | 'avatar'
    | 'account'
    | 'todo'
    | 'task_action'
    | 'group'
    | 'group_action';

export interface Command {
    id: string;
    labelKey: string; // Translation key
    label?: string; // Translated label
    descriptionKey?: string; // Translation key for description
    description?: string; // Translated description
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
    readonly #platformId = inject(PLATFORM_ID);
    readonly #colorService = inject(ColorService);
    readonly #themeService = inject(ThemeService);
    readonly #languageService = inject(LanguageService);
    readonly #snowService = inject(SnowService);
    readonly #authStore = inject(AuthStore);
    readonly #todoStore = inject(TodoStore);
    readonly #groupStore = inject(GroupStore);
    readonly #router = inject(Router);

    // State signals
    readonly isOpen = signal(false);

    // All available commands
    readonly commands = computed<Command[]>(() => {
        const isAuthenticated = this.#authStore.isAuthenticated();
        const hasAvatar = !!this.#authStore.userAvatar();

        return BASE_COMMANDS_CONFIG.map((config) => ({
            ...config,
            action: (): void => this.#executeBaseCommand(config.id),
            visible: (): boolean =>
                this.#isCommandVisible(config.id, isAuthenticated, hasAvatar),
        })).filter((cmd) => (cmd.visible ? cmd.visible() : true));
    });

    #executeBaseCommand(id: string): void {
        switch (id) {
            case 'theme-light':
                this.changeTheme('light');
                break;
            case 'theme-dark':
                this.changeTheme('dark');
                break;
            case 'theme-system':
                this.changeTheme('system');
                break;
            case 'theme-snow-toggle':
                this.#toggleSnow();
                break;
            case 'lang-en':
                this.changeLanguage('en');
                break;
            case 'lang-pl':
                this.changeLanguage('pl');
                break;
            case 'color-ocean':
                this.changeColorPalette('ocean-depth');
                break;
            case 'color-sunset':
                this.changeColorPalette('sunset-gradient');
                break;
            case 'color-forest':
                this.changeColorPalette('forest-night');
                break;
            case 'color-royal':
                this.changeColorPalette('royal-purple');
                break;
            case 'color-cyber':
                this.changeColorPalette('cyberpunk');
                break;
            case 'avatar-change':
                this.changeAvatar();
                break;
            case 'avatar-delete':
                this.deleteAvatar();
                break;
            case 'logout':
                this.logout();
                break;
            case 'todo-add':
                this.addTodo();
                break;
            case 'group-add-static':
                this.addGroup();
                break;
        }
    }

    #isCommandVisible(
        id: string,
        isAuthenticated: boolean,
        hasAvatar: boolean,
    ): boolean {
        if (id === 'avatar-change') return isAuthenticated;
        if (id === 'avatar-delete') return isAuthenticated && hasAvatar;
        if (id === 'logout') return isAuthenticated;
        if (id === 'todo-add') return isAuthenticated;
        if (id === 'group-add-static') return isAuthenticated;

        return true;
    }

    #toggleSnow(): void {
        this.#snowService.toggle();
        this.close();
    }

    /**
     * Dynamically generates task-specific commands (Edit, Delete, Toggle)
     * based on search query and current tasks in TodoStore.
     */
    getTaskCommands(query: string): Command[] {
        const queryLower = query.toLowerCase().trim();
        if (!this.#authStore.isAuthenticated()) return [];

        const allTodos = this.#todoStore.todos();
        const allGroups = this.#groupStore.groups();
        const commands: Command[] = [];

        // --- Task Commands ---
        const tasks = queryLower
            ? allTodos.filter((t) => t.title.toLowerCase().includes(queryLower))
            : []; // Only show tasks when searching in palette to avoid clutter

        tasks.forEach((task) => {
            // Edit Command
            commands.push({
                id: `task-edit-${task.id}`,
                labelKey: 'COMMAND_PALETTE.COMMANDS.TASK_EDIT_DESC',
                customLabel: task.title,
                icon: 'pi pi-pencil',
                category: 'task_action' as CommandCategory,
                action: (): void => {
                    this.#todoStore.showEditForm(task.id);
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
                    this.#todoStore.toggleTodo(task);
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
                    this.#todoStore.deleteTodo(task.id);
                    this.close();
                },
            });
        });

        // --- Group Commands ---
        const matchedGroups = queryLower
            ? allGroups.filter((g) => g.name.toLowerCase().includes(queryLower))
            : allGroups;

        matchedGroups.forEach((group) => {
            const isSelected = this.#groupStore
                .selectedGroupIds()
                .includes(group.id);

            // Select/Unselect Group
            commands.push({
                id: `group-select-${group.id}`,
                labelKey: isSelected
                    ? 'COMMAND_PALETTE.COMMANDS.GROUP_UNSELECT'
                    : 'COMMAND_PALETTE.COMMANDS.GROUP_SELECT',
                customLabel: group.name,
                icon: isSelected ? 'pi pi-check-square' : 'pi pi-stop',
                category: queryLower
                    ? ('group_action' as CommandCategory)
                    : ('group' as CommandCategory),
                action: (): void => {
                    this.#groupStore.toggleGroupSelection(group.id);
                    if (queryLower) this.close();
                },
            });

            // Delete Group (only when searching)
            if (queryLower) {
                commands.push({
                    id: `group-delete-${group.id}`,
                    labelKey: 'COMMAND_PALETTE.COMMANDS.GROUP_DELETE_DESC',
                    customLabel: group.name,
                    icon: 'pi pi-trash',
                    category: 'group_action' as CommandCategory,
                    action: (): void => {
                        this.#groupStore.deleteGroup(group.id);
                        this.close();
                    },
                });
            }
        });

        // --- "Add Group" Command ---
        if (
            queryLower &&
            !allGroups.some((g) => g.name.toLowerCase() === queryLower)
        ) {
            commands.push({
                id: 'group-add-dynamic',
                labelKey: 'COMMAND_PALETTE.COMMANDS.GROUP_ADD',
                customLabel: queryLower,
                icon: 'pi pi-plus-circle',
                category: 'group' as CommandCategory,
                action: (): void => {
                    this.#groupStore.createGroup({ name: query.trim() });
                    this.close();
                },
            });
        }

        return commands;
    }

    constructor() {
        if (isPlatformBrowser(this.#platformId)) {
            this.#setupKeyboardShortcut();
        }
    }

    #setupKeyboardShortcut(): void {
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
        this.#colorService.setColorPalette(palette);
        this.close();
    }

    private changeTheme(theme: ThemeMode): void {
        this.#themeService.setMode(theme);
        this.close();
    }

    private changeLanguage(lang: string): void {
        this.#languageService.setLanguage(lang);
        this.#authStore.syncLanguage(lang);
        this.close();
    }

    private changeAvatar(): void {
        if (isPlatformBrowser(this.#platformId)) {
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
        if (isPlatformBrowser(this.#platformId)) {
            window.dispatchEvent(new CustomEvent('delete-avatar-command'));
        }
        this.close();
    }

    private logout(): void {
        this.#authStore.logout();
        this.#router.navigate(['/login']);
        this.close();
    }

    private addTodo(): void {
        this.#todoStore.showCreateForm();
        this.close();
    }

    private addGroup(): void {
        this.#groupStore.showCreateDialog();
        this.close();
    }
}
