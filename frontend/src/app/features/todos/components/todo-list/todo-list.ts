import { isPlatformBrowser } from '@angular/common';
import {
    Component,
    inject,
    OnInit,
    PLATFORM_ID,
    signal,
    viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Todo, TodoCreate, UserResponse } from '@api';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService } from 'primeng/api';
import { Button, ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { CheckboxModule } from 'primeng/checkbox';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { ScreenSizeService } from '../../../../core/services/screen-size.service';
import { AuthStore } from '../../../../core/store/auth.store';
import { TodoStore } from '../../store/todo.store';
import { TodoFormComponent } from '../todo-form/todo-form';

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
        TranslatePipe,
    ],
    providers: [ConfirmationService],
    templateUrl: './todo-list.html',
    styleUrl: './todo-list.scss',
})
export class TodoListComponent implements OnInit {
    // Inject TodoStore for centralized state management
    readonly store = inject(TodoStore);
    private authStore = inject(AuthStore);
    private confirmationService = inject(ConfirmationService);
    private platformId = inject(PLATFORM_ID);
    private translate = inject(TranslateService);
    public screenSize = inject(ScreenSizeService);

    isBrowser = signal(false);

    // Expose store signals directly to template
    readonly todos = this.store.todos;
    readonly loading = this.store.loading;
    readonly error = this.store.error;
    readonly editingTodo = this.store.editingTodo;
    readonly formVisible = this.store.formVisible;
    readonly completedTodos = this.store.completedTodos;
    readonly pendingTodos = this.store.pendingTodos;
    readonly totalTodos = this.store.totalCount;

    addButton = viewChild<Button>('addButton');

    get currentUser(): UserResponse | null {
        return this.authStore.currentUser();
    }

    ngOnInit(): void {
        this.isBrowser.set(isPlatformBrowser(this.platformId));
        if (this.isBrowser()) {
            this.store.loadTodos();
        }
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

    hideForm(): void {
        this.store.hideForm();

        // Restore focus to the add button after dialog is hidden
        setTimeout(() => {
            const buttonEl = this.addButton();
            if (buttonEl?.el?.nativeElement) {
                // p-button component wraps a native <button> element
                // We need to find and focus the actual button inside
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
        return !!user && user.id === todo.user_id;
    }

    clearError(): void {
        this.store.clearError();
    }
}
