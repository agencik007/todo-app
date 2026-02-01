import { isPlatformBrowser } from '@angular/common';
import {
    Component,
    computed,
    effect,
    ElementRef,
    inject,
    PLATFORM_ID,
    signal,
    viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { DialogModule } from 'primeng/dialog';
import {
    Command,
    CommandCategory,
    CommandPaletteService,
} from '../../../core/services/command-palette.service';

interface CommandGroup {
    category: CommandCategory;
    categoryLabelKey: string;
    commands: Command[];
}

@Component({
    selector: 'app-command-palette',
    imports: [DialogModule, FormsModule, TranslatePipe],
    templateUrl: './command-palette.html',
    styleUrl: './command-palette.scss',
})
export class CommandPaletteComponent {
    commandPaletteService = inject(CommandPaletteService);
    platformId = inject(PLATFORM_ID);

    // Element references
    searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');
    commandsList = viewChild<ElementRef<HTMLElement>>('commandsList');

    searchQuery = signal('');
    selectedIndex = signal(0);

    readonly isOpen = this.commandPaletteService.isOpen;

    // Filter commands based on search query
    readonly filteredCommands = computed(() => {
        const query = this.searchQuery().toLowerCase().trim();
        const baseCommands = this.commandPaletteService.commands();
        const taskCommands = this.commandPaletteService.getTaskCommands(query);

        const allVisibleCommands = [...baseCommands, ...taskCommands];

        if (!query) {
            return baseCommands;
        }

        return allVisibleCommands.filter((cmd) => {
            const labelMatch = cmd.labelKey.toLowerCase().includes(query);
            const customLabelMatch = cmd.customLabel
                ?.toLowerCase()
                .includes(query);
            return labelMatch || customLabelMatch;
        });
    });

    // Group filtered commands by category
    readonly groupedCommands = computed<CommandGroup[]>(() => {
        const commands = this.filteredCommands();
        const groups = new Map<CommandCategory, Command[]>();

        commands.forEach((cmd) => {
            if (!groups.has(cmd.category)) {
                groups.set(cmd.category, []);
            }
            groups.get(cmd.category)!.push(cmd);
        });

        const categoryLabels: Record<CommandCategory, string> = {
            color: 'COMMAND_PALETTE.CATEGORIES.COLOR',
            theme: 'COMMAND_PALETTE.CATEGORIES.THEME',
            language: 'COMMAND_PALETTE.CATEGORIES.LANGUAGE',
            avatar: 'COMMAND_PALETTE.CATEGORIES.AVATAR',
            account: 'COMMAND_PALETTE.CATEGORIES.ACCOUNT',
            todo: 'COMMAND_PALETTE.CATEGORIES.TODO',
            task_action: 'COMMAND_PALETTE.CATEGORIES.TASK_ACTION',
        };

        return Array.from(groups.entries()).map(([category, cmds]) => ({
            category,
            categoryLabelKey: categoryLabels[category],
            commands: cmds,
        }));
    });

    constructor() {
        // Reset search and focus input when dialog opens
        effect(() => {
            if (this.isOpen()) {
                this.searchQuery.set('');
                this.selectedIndex.set(0);

                if (isPlatformBrowser(this.platformId)) {
                    // Wait for render
                    setTimeout(() => {
                        this.searchInput()?.nativeElement.focus();
                    }, 50);
                }
            }
        });

        // Reset selected index when search changes
        effect(() => {
            this.searchQuery();
            this.selectedIndex.set(0);
        });

        // Handle scrolling to selected element
        effect(() => {
            this.selectedIndex(); // Access the signal to track changes

            if (isPlatformBrowser(this.platformId)) {
                const list = this.commandsList()?.nativeElement;
                if (list) {
                    // Wait for next tick to ensure querySelector works after view updates
                    setTimeout(() => {
                        const selectedEl = list.querySelector(
                            '.command-item.selected',
                        );
                        if (selectedEl && selectedEl.scrollIntoView) {
                            selectedEl.scrollIntoView({
                                block: 'nearest',
                                behavior: 'smooth',
                            });
                        }
                    }, 0);
                }
            }
        });
    }

    handleKeyboard(event: KeyboardEvent): void {
        const commandCount = this.filteredCommands().length;

        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                this.selectedIndex.update((idx) =>
                    idx < commandCount - 1 ? idx + 1 : 0,
                );
                break;
            case 'ArrowUp':
                event.preventDefault();
                this.selectedIndex.update((idx) =>
                    idx > 0 ? idx - 1 : commandCount - 1,
                );
                break;
            case 'Enter': {
                event.preventDefault();
                const selectedCommand =
                    this.filteredCommands()[this.selectedIndex()];
                if (selectedCommand) {
                    this.executeCommand(selectedCommand);
                }
                break;
            }
            case 'Escape':
                event.preventDefault();
                this.commandPaletteService.close();
                break;
        }
    }

    executeCommand(command: Command): void {
        command.action();
    }

    onVisibleChange(visible: boolean): void {
        if (!visible) {
            this.commandPaletteService.close();
        }
    }

    trackByCommandId(index: number, command: Command): string {
        return command.id;
    }

    getCommandIndex(command: Command): number {
        return this.filteredCommands().indexOf(command);
    }
}
