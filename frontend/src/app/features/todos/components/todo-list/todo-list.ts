import { isPlatformBrowser } from '@angular/common';
import {
    Component,
    computed,
    inject,
    OnInit,
    PLATFORM_ID,
    signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Todo, TodoCreate } from '@api';
import { delay } from 'rxjs/operators';
import { AuthStateService } from '../../../../core/services/auth-state.service';
import { TodoService } from '../../services/todo.service';
import { TodoFormComponent } from '../todo-form/todo-form';

// PrimeNG
import { UserResponse } from '@api';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { CheckboxModule } from 'primeng/checkbox';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';

@Component({
    selector: 'app-todo-list',
    imports: [
        FormsModule,
        TodoFormComponent,
        CardModule,
        ButtonModule,
        CheckboxModule,
        TagModule,
        ProgressSpinnerModule,
        SkeletonModule,
        DialogModule,
        MessageModule,
        ConfirmDialogModule,
    ],
    providers: [ConfirmationService],
    templateUrl: './todo-list.html',
    styleUrl: './todo-list.scss',
})
export class TodoListComponent implements OnInit {
    private todoService = inject(TodoService);
    private authStateService = inject(AuthStateService);
    private confirmationService = inject(ConfirmationService);
    private platformId = inject(PLATFORM_ID);

    todos = signal<Todo[]>([]);
    loading = signal(false);
    error = signal<string | null>(null);
    editingTodo = signal<Todo | null>(null);
    formVisible = false;
    isBrowser = signal(false);

    completedTodos = computed(() =>
        this.todos().filter((todo) => todo.completed),
    );
    pendingTodos = computed(() =>
        this.todos().filter((todo) => !todo.completed),
    );
    totalTodos = computed(() => this.todos().length);

    get currentUser(): UserResponse | null {
        return this.authStateService.currentUser();
    }

    ngOnInit(): void {
        this.isBrowser.set(isPlatformBrowser(this.platformId));
        if (this.isBrowser()) {
            this.loadTodos();
        }
    }

    loadTodos(): void {
        this.loading.set(true);
        this.error.set(null);
        this.todoService
            .getTodos()
            .pipe(delay(2500))
            .subscribe({
                next: (todos) => {
                    this.todos.set(todos);
                    this.loading.set(false);
                },
                error: () => {
                    this.error.set('Nie udało się załadować zadań');
                    this.loading.set(false);
                },
            });
    }

    showCreateForm(): void {
        this.editingTodo.set(null);
        this.formVisible = true;
    }

    editTodo(todo: Todo): void {
        if (!this.canEditTodo(todo)) {
            this.error.set('Nie masz uprawnień do edycji tego zadania');
            return;
        }
        this.editingTodo.set(todo);
        this.formVisible = true;
    }

    hideForm(): void {
        this.formVisible = false;
        this.editingTodo.set(null);
    }

    saveTodo(todoData: TodoCreate): void {
        if (this.editingTodo()) {
            this.updateTodo(this.editingTodo()!.id, todoData);
        } else {
            this.createTodo(todoData);
        }
    }

    private createTodo(todoData: TodoCreate): void {
        this.todoService.createTodo(todoData).subscribe({
            next: (newTodo) => {
                this.todos.update((todos) => [...todos, newTodo]);
                this.hideForm();
            },
            error: () => {
                this.error.set('Nie udało się utworzyć zadania');
            },
        });
    }

    private updateTodo(id: number, todoData: TodoCreate): void {
        this.todoService.updateTodo(id, todoData).subscribe({
            next: (updatedTodo) => {
                this.todos.update((todos) =>
                    todos.map((todo) => (todo.id === id ? updatedTodo : todo)),
                );
                this.hideForm();
            },
            error: () => {
                this.error.set('Nie udało się zaktualizować zadania');
            },
        });
    }

    toggleTodoCompletion(todo: Todo): void {
        this.todoService
            .updateTodo(todo.id, { completed: !todo.completed })
            .subscribe({
                next: (updatedTodo) => {
                    this.todos.update((todos) =>
                        todos.map((t) => (t.id === todo.id ? updatedTodo : t)),
                    );
                },
                error: () => {
                    this.error.set('Nie udało się zmienić statusu zadania');
                },
            });
    }

    deleteTodo(todo: Todo): void {
        if (!this.canEditTodo(todo)) {
            this.error.set('Nie masz uprawnień do usunięcia tego zadania');
            return;
        }

        this.confirmationService.confirm({
            message: `Czy na pewno chcesz usunąć zadanie "${todo.title}"?`,
            header: 'Potwierdź usunięcie',
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Tak, usuń',
            rejectLabel: 'Anuluj',
            accept: () => {
                this.todoService.deleteTodo(todo.id).subscribe({
                    next: () => {
                        this.todos.update((todos) =>
                            todos.filter((t) => t.id !== todo.id),
                        );
                    },
                    error: () => {
                        this.error.set('Nie udało się usunąć zadania');
                    },
                });
            },
        });
    }

    canEditTodo(todo: Todo): boolean {
        const user = this.currentUser;
        return !!user && user.id === todo.user_id;
    }

    clearError(): void {
        this.error.set(null);
    }
}
