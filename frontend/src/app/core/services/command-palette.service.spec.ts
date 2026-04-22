import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { GroupStore } from '../../features/groups/store/group.store';
import { TodoStore } from '../../features/todos/store/todo.store';
import { AuthStore } from '../store/auth.store';
import { ColorService } from './color.service';
import { CommandPaletteService } from './command-palette.service';
import { LanguageService } from './language.service';
import { ThemeService } from './theme.service';

// Mock dependencies
class MockAuthStore {
    isAuthenticated = signal(true);
    userAvatar = signal(null);
}

class MockGroupStore {
    groups = signal([]);
    selectedGroupIds = signal([]);
    createGroup = jasmine.createSpy('createGroup');
}

class MockTodoStore {
    todos = signal([]);
}

describe('CommandPaletteService', () => {
    let service: CommandPaletteService;
    let groupStore: MockGroupStore;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                CommandPaletteService,
                { provide: GroupStore, useClass: MockGroupStore },
                { provide: AuthStore, useClass: MockAuthStore },
                { provide: TodoStore, useClass: MockTodoStore },
                {
                    provide: ColorService,
                    useValue: { setColorPalette: jasmine.createSpy() },
                },
                {
                    provide: ThemeService,
                    useValue: { setMode: jasmine.createSpy() },
                },
                {
                    provide: LanguageService,
                    useValue: { setLanguage: jasmine.createSpy() },
                },
                {
                    provide: Router,
                    useValue: { navigate: jasmine.createSpy() },
                },
            ],
        });

        service = TestBed.inject(CommandPaletteService);
        groupStore = TestBed.inject(GroupStore) as unknown as MockGroupStore;
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should call createGroup with correct casing', () => {
        const query = 'My Group';
        const commands = service.getTaskCommands(query);
        const addCommand = commands.find((c) => c.id === 'group-add-dynamic');

        expect(addCommand).toBeDefined();
        if (addCommand) {
            addCommand.action();
            expect(groupStore.createGroup).toHaveBeenCalledWith({
                name: 'My Group',
            });
        }
    });
});
