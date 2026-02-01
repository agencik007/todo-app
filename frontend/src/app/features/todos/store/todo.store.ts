import { computed, inject, Injectable, signal } from '@angular/core';
import { Todo, TodoCreate, TodoUpdate } from '@api';
import { TodoService } from '../services/todo.service';

/**
 * TodoStore - Centralized state management for todos using Angular Signals.
 *
 * This store follows the Signal Store pattern with:
 * - Private writable signals for internal state
 * - Public readonly signals for consumers
 * - Computed signals for derived state
 * - Methods for state mutations
 */
@Injectable({
    providedIn: 'root',
})
export class TodoStore {
    private todoService = inject(TodoService);

    // Private writable state signals
    private readonly _todos = signal<Todo[]>([]);
    private readonly _loading = signal(false);
    private readonly _error = signal<string | null>(null);
    private readonly _editingTodoId = signal<number | null>(null);
    private readonly _formVisible = signal(false);

    // Public readonly signals (exposed to components)
    readonly todos = this._todos.asReadonly();
    readonly loading = this._loading.asReadonly();
    readonly error = this._error.asReadonly();
    readonly formVisible = this._formVisible.asReadonly();

    // Computed signals for derived state
    readonly completedTodos = computed(() =>
        this._todos().filter((todo) => todo.completed),
    );

    readonly pendingTodos = computed(() =>
        this._todos().filter((todo) => !todo.completed),
    );

    readonly totalCount = computed(() => this._todos().length);

    readonly editingTodo = computed(
        () => this._todos().find((t) => t.id === this._editingTodoId()) ?? null,
    );

    // ==================== Actions ====================

    loadTodos(): void {
        this._loading.set(true);
        this._error.set(null);

        this.todoService.getTodos().subscribe({
            next: (todos) => {
                this._todos.set(todos);
                this._loading.set(false);
            },
            error: (err) => {
                const errorDetail = err.error?.detail;
                const messageCode =
                    errorDetail?.messageCode || err.error?.messageCode;
                this._error.set(
                    messageCode || err.message || 'An error occurred',
                );
                this._loading.set(false);
            },
        });
    }

    createTodo(todoData: TodoCreate): void {
        this.todoService.createTodo(todoData).subscribe({
            next: (newTodo) => {
                this._todos.update((todos) => [...todos, newTodo]);
                this.hideForm();
            },
            error: (err: Error) => {
                this._error.set(err.message);
            },
        });
    }

    updateTodo(id: number, update: TodoUpdate): void {
        this.todoService.updateTodo(id, update).subscribe({
            next: (updatedTodo) => {
                this._todos.update((todos) =>
                    todos.map((t) => (t.id === id ? updatedTodo : t)),
                );
                this.hideForm();
            },
            error: (err: Error) => {
                this._error.set(err.message);
            },
        });
    }

    deleteTodo(id: number): void {
        this.todoService.deleteTodo(id).subscribe({
            next: () => {
                this._todos.update((todos) => todos.filter((t) => t.id !== id));
            },
            error: (err: Error) => {
                this._error.set(err.message);
            },
        });
    }

    toggleTodo(todo: Todo): void {
        this.todoService
            .updateTodo(todo.id, { completed: !todo.completed })
            .subscribe({
                next: (updated) => {
                    this._todos.update((todos) =>
                        todos.map((t) => (t.id === todo.id ? updated : t)),
                    );
                },
                error: (err) => {
                    const errorDetail = err.error?.detail;
                    const messageCode =
                        errorDetail?.messageCode || err.error?.messageCode;
                    this._error.set(
                        messageCode || err.message || 'An error occurred',
                    );
                },
            });
    }

    // ==================== UI State Actions ====================

    showCreateForm(): void {
        this._editingTodoId.set(null);
        this._formVisible.set(true);
    }

    showEditForm(id: number): void {
        this._editingTodoId.set(id);
        this._formVisible.set(true);
    }

    hideForm(): void {
        this._editingTodoId.set(null);
        this._formVisible.set(false);
    }

    setError(message: string): void {
        this._error.set(message);
    }

    clearError(): void {
        this._error.set(null);
    }
}
