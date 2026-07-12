import {
    CdkDragDrop,
    CdkDragMove,
    DragDropModule,
} from '@angular/cdk/drag-drop';
import { isPlatformBrowser } from '@angular/common';
import {
    Component,
    computed,
    ElementRef,
    HostListener,
    inject,
    OnInit,
    PLATFORM_ID,
    signal,
    viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Todo, TodoCreate, UserResponse } from '@api';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import moment from 'moment';
import 'moment/locale/pl';
import { ConfirmationService } from 'primeng/api';
import { Button, ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { CheckboxModule } from 'primeng/checkbox';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { ScreenSizeService } from '../../../../core/services/screen-size.service';
import { AuthStore } from '../../../../core/store/auth.store';
import { GroupBadgeComponent } from '../../../groups/components/group-badge/group-badge.component';
import { SidebarComponent } from '../../../groups/components/sidebar/sidebar.component';
import { GroupStore } from '../../../groups/store/group.store';
import { TodoStore } from '../../store/todo.store';
import { TodoFormComponent } from '../todo-form/todo-form';

type StatusFilter = 'all' | 'pending' | 'completed';

@Component({
    selector: 'app-todo-list',
    imports: [
        FormsModule,
        TodoFormComponent,
        CardModule,
        ButtonModule,
        CheckboxModule,
        TagModule,
        SkeletonModule,
        DialogModule,
        MessageModule,
        ConfirmDialogModule,
        InputTextModule,
        TranslatePipe,
        DragDropModule,
        TooltipModule,
        SidebarComponent,
        GroupBadgeComponent,
    ],
    providers: [ConfirmationService],
    templateUrl: './todo-list.html',
    styleUrl: './todo-list.scss',
})
export class TodoListComponent implements OnInit {
    readonly store = inject(TodoStore);
    private authStore = inject(AuthStore);
    private groupStore = inject(GroupStore);
    private confirmationService = inject(ConfirmationService);
    private platformId = inject(PLATFORM_ID);
    private translate = inject(TranslateService);
    public screenSize = inject(ScreenSizeService);

    isBrowser = signal(false);

    userName = computed(() => {
        const user = this.currentUser;
        if (!user || !user.email) return '';
        return user.email.split('@')[0];
    });

    readonly loading = this.store.loading;
    readonly error = this.store.error;
    readonly editingTodo = this.store.editingTodo;
    readonly formVisible = this.store.formVisible;
    readonly completedTodos = this.store.completedTodos;
    readonly pendingTodos = this.store.pendingTodos;
    readonly totalTodos = this.store.totalCount;

    readonly selectedGroups = this.groupStore.selectedGroups;
    readonly hasGroupSelection = this.groupStore.hasSelection;

    readonly statusFilter = signal<StatusFilter>('all');
    readonly searchQuery = signal('');
    readonly focusedIndex = signal(-1);

    readonly displayedTodos = computed(() => {
        const status = this.statusFilter();
        const query = this.searchQuery().trim().toLowerCase();
        let list = this.store.filteredTodos();

        if (status === 'pending') {
            list = list.filter((t) => !t.completed);
        } else if (status === 'completed') {
            list = list.filter((t) => t.completed);
        }

        if (query) {
            list = list.filter(
                (t) =>
                    t.title.toLowerCase().includes(query) ||
                    (t.description?.toLowerCase().includes(query) ?? false),
            );
        }

        return list;
    });

    readonly todos = this.displayedTodos;

    readonly progressPercent = computed(() => {
        const total = this.store.totalCount();
        if (total === 0) return 0;
        return Math.round((this.completedTodos().length / total) * 100);
    });

    readonly isFiltered = computed(
        () =>
            this.statusFilter() !== 'all' ||
            this.searchQuery().trim().length > 0,
    );

    addButton = viewChild<Button>('addButton');
    scrollContainer = viewChild<ElementRef<HTMLElement>>('scrollContainer');
    searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');
    todoForm = viewChild(TodoFormComponent);

    #scrollSpeed = 0;
    #scrollAnimationId: number | null = null;

    get currentUser(): UserResponse | null {
        return this.authStore.currentUser();
    }

    ngOnInit(): void {
        this.isBrowser.set(isPlatformBrowser(this.platformId));
        if (this.isBrowser()) {
            this.groupStore.loadGroups();
        }
    }

    setStatusFilter(filter: StatusFilter): void {
        this.statusFilter.set(filter);
        this.focusedIndex.set(-1);
    }

    onSearchInput(value: string): void {
        this.searchQuery.set(value);
        this.focusedIndex.set(-1);
    }

    clearSearch(): void {
        this.searchQuery.set('');
        this.searchInput()?.nativeElement.focus();
    }

    resetFilters(): void {
        this.statusFilter.set('all');
        this.searchQuery.set('');
        this.focusedIndex.set(-1);
    }

    focusSearch(): void {
        const el = this.searchInput()?.nativeElement;
        if (el) {
            el.focus();
            el.select();
        }
    }

    @HostListener('window:keydown', ['$event'])
    handleKeyboard(event: KeyboardEvent): void {
        if (this.formVisible()) return;
        if (event.ctrlKey || event.metaKey || event.altKey) return;

        const target = event.target as HTMLElement | null;
        const isTyping =
            !!target &&
            (target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                target.isContentEditable);

        if (isTyping) {
            if (event.key === 'Escape' && target?.id === 'todo-search-input') {
                event.preventDefault();
                this.searchQuery.set('');
                target.blur();
            }
            return;
        }

        switch (event.key) {
            case 'n':
            case 'N':
                event.preventDefault();
                this.showCreateForm();
                break;
            case '/':
                event.preventDefault();
                this.focusSearch();
                break;
            case 'j':
            case 'J':
                event.preventDefault();
                this.moveFocus(1);
                break;
            case 'k':
            case 'K':
                event.preventDefault();
                this.moveFocus(-1);
                break;
            case 'x':
            case 'X':
                event.preventDefault();
                this.toggleFocusedTodo();
                break;
        }
    }

    moveFocus(delta: number): void {
        const list = this.todos();
        if (list.length === 0) return;
        const current = this.focusedIndex();
        let next = current + delta;
        if (current === -1) {
            next = delta > 0 ? 0 : list.length - 1;
        }
        next = Math.max(0, Math.min(list.length - 1, next));
        this.focusedIndex.set(next);
        this.scrollFocusedIntoView();
    }

    setFocus(index: number): void {
        this.focusedIndex.set(index);
    }

    toggleFocusedTodo(): void {
        const idx = this.focusedIndex();
        const list = this.todos();
        if (idx < 0 || idx >= list.length) return;
        const todo = list[idx];
        if (!this.canEditTodo(todo)) return;
        this.toggleTodoCompletion(todo);
    }

    private scrollFocusedIntoView(): void {
        if (!this.isBrowser()) return;
        queueMicrotask(() => {
            const container = this.scrollContainer()?.nativeElement;
            if (!container) return;
            const el = container.querySelector<HTMLElement>(
                '.todo-row.is-focused',
            );
            if (el) {
                el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        });
    }

    showCreateForm(): void {
        this.store.showCreateForm();
    }

    editTodo(todo: Todo): void {
        if (!this.canEditTodo(todo)) {
            this.store.setError(
                this.translate.instant('TODOS.MESSAGES.ERROR_NO_PERM_EDIT'),
            );
            return;
        }
        this.store.showEditForm(todo.id);
    }

    onVisibleChange(isVisible: boolean): void {
        if (!isVisible) {
            this.store.hideForm();
        }
    }

    onDialogHide(): void {
        this.restoreFocus();
    }

    closeForm(): void {
        this.store.hideForm();
    }

    restoreFocus(): void {
        setTimeout(() => {
            const buttonEl = this.addButton();
            if (buttonEl?.el?.nativeElement) {
                const nativeButton =
                    buttonEl.el.nativeElement.querySelector('button');
                if (nativeButton) {
                    nativeButton.focus();
                }
            }
        }, 100);
    }

    saveTodo(todoData: TodoCreate): void {
        const editing = this.store.editingTodo();
        if (editing) {
            this.store.updateTodo(editing.id, todoData);
        } else {
            this.store.createTodo(todoData);
        }
    }

    toggleTodoCompletion(todo: Todo): void {
        this.store.toggleTodo(todo);
    }

    deleteTodo(todo: Todo): void {
        if (!this.canEditTodo(todo)) {
            this.store.setError(
                this.translate.instant('TODOS.MESSAGES.ERROR_NO_PERM_DELETE'),
            );
            return;
        }

        this.confirmationService.confirm({
            message: this.translate.instant(
                'TODOS.MESSAGES.DELETE_CONFIRM_MESSAGE',
                { title: todo.title },
            ),
            header: this.translate.instant(
                'TODOS.MESSAGES.DELETE_CONFIRM_TITLE',
            ),
            icon: 'pi pi-exclamation-triangle',
            acceptLabel:
                this.translate.instant('TODOS.FORM.SUBMIT_DELETE') ||
                'Tak, usuń',
            rejectLabel: this.translate.instant('TODOS.FORM.CANCEL'),
            accept: () => {
                this.store.deleteTodo(todo.id);
            },
        });
    }

    canEditTodo(todo: Todo): boolean {
        const user = this.currentUser;
        return !!user && user.id === todo.userId;
    }

    onDrop(event: CdkDragDrop<Todo[]>): void {
        this.#stopScrollLoop();
        if (event.previousContainer === event.container) {
            if (event.previousIndex === event.currentIndex) {
                return;
            }
            const todoToMove = this.todos()[event.previousIndex];
            this.store.reorderTodo(todoToMove.id, event.currentIndex);
        }
    }

    onDragMoved(event: CdkDragMove): void {
        const container = this.scrollContainer()?.nativeElement;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const pointerY = event.pointerPosition.y;

        const threshold = 100;
        const maxSpeed = 15;

        if (pointerY < rect.top + threshold) {
            const distance = rect.top + threshold - pointerY;
            this.#scrollSpeed = -Math.min(
                maxSpeed,
                (distance / threshold) * maxSpeed,
            );
            this.#startScrollLoop();
        } else if (pointerY > rect.bottom - threshold) {
            const distance = pointerY - (rect.bottom - threshold);
            this.#scrollSpeed = Math.min(
                maxSpeed,
                (distance / threshold) * maxSpeed,
            );
            this.#startScrollLoop();
        } else {
            this.#scrollSpeed = 0;
            this.#stopScrollLoop();
        }
    }

    onDragEnded(): void {
        this.#stopScrollLoop();
    }

    #startScrollLoop(): void {
        if (this.#scrollAnimationId !== null) return;

        const loop = (): void => {
            const container = this.scrollContainer()?.nativeElement;
            if (container && this.#scrollSpeed !== 0) {
                container.scrollTop += this.#scrollSpeed;
                this.#scrollAnimationId = requestAnimationFrame(loop);
            } else {
                this.#scrollAnimationId = null;
            }
        };

        this.#scrollAnimationId = requestAnimationFrame(loop);
    }

    #stopScrollLoop(): void {
        if (this.#scrollAnimationId !== null) {
            cancelAnimationFrame(this.#scrollAnimationId);
            this.#scrollAnimationId = null;
        }
        this.#scrollSpeed = 0;
    }

    clearError(): void {
        this.store.clearError();
    }

    getGroupById(groupId: number | null | undefined): any {
        if (!groupId) return undefined;
        return this.groupStore.groups().find((g) => g.id === groupId);
    }

    formatDate(dateString: string | undefined): string {
        if (!dateString) return '';
        return moment(dateString).format('DD.MM.YYYY HH:mm');
    }

    getRelativeTime(dateString: string | undefined): string {
        if (!dateString) return '';
        const lang =
            this.translate.currentLang || this.translate.defaultLang || 'en';
        moment.locale(lang);
        return moment(dateString).fromNow();
    }
}
