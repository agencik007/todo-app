import {
    computed,
    inject,
    Injectable,
    linkedSignal,
    signal,
} from '@angular/core';
import { Todo, TodoCreate, TodoUpdate } from '@api';
import { GroupStore } from '../../groups/store/group.store';
import { TodoService } from '../services/todo.service';

/**
 * TodoStore - Centralized state management for todos using Angular Signals.
 *
 * This store follows the Signal Store pattern with:
 * - httpResource for reactive data fetching
 * - linkedSignal for local mutations (optimistic updates) synchronized with resource
 * - Computed signals for derived state
 * - Methods for state mutations
 */
@Injectable({
    providedIn: 'root',
})
export class TodoStore {
    readonly #todoService = inject(TodoService);
    readonly #groupStore = inject(GroupStore);

    // Local state synchronized with httpResource, allowing local mutations
    private readonly _todos = linkedSignal<Todo[]>(
        () => this.#todoService.todosResource.value() ?? [],
    );
    private readonly _editingTodoId = signal<number | null>(null);
    private readonly _formVisible = signal(false);

    // Public readonly signals
    readonly todos = this._todos.asReadonly();
    readonly loading = this.#todoService.todosResource.isLoading;
    readonly error = computed(() => {
        const err = this.#todoService.todosResource.error();
        if (err) {
            const msg =
                (err as any)?.error?.detail?.messageCode ||
                (err as any)?.error?.messageCode ||
                (err as any)?.message ||
                'An error occurred';
            return msg as string;
        }
        return null;
    });
    readonly formVisible = this._formVisible.asReadonly();

    // Reactive filtering based on GroupStore selection
    readonly filteredTodos = computed(() => {
        const selectedIds = this.#groupStore.selectedGroupIds();
        const allTodos = this._todos();

        if (selectedIds.length === 0) {
            return allTodos;
        }

        return allTodos.filter(
            (t) => t.groupId && selectedIds.includes(t.groupId),
        );
    });

    // Computed signals for derived state
    readonly completedTodos = computed(() =>
        this.filteredTodos().filter((todo) => todo.completed),
    );

    readonly pendingTodos = computed(() =>
        this.filteredTodos().filter((todo) => !todo.completed),
    );

    readonly totalCount = computed(() => this.filteredTodos().length);

    readonly editingTodo = computed(
        () => this._todos().find((t) => t.id === this._editingTodoId()) ?? null,
    );

    // ==================== Actions ====================

    loadTodos(): void {
        this.#todoService.todosResource.reload();
    }

    createTodo(todoData: TodoCreate): void {
        this.#todoService.createTodo(todoData).subscribe({
            next: (newTodo) => {
                this._todos.update((todos) => [...todos, newTodo]);
                this.hideForm();
            },
            error: (err) => console.error('Create todo failed:', err),
        });
    }

    updateTodo(id: number, update: TodoUpdate): void {
        this.#todoService.updateTodo(id, update).subscribe({
            next: (updatedTodo) => {
                this._todos.update((todos) =>
                    todos.map((t) => (t.id === id ? updatedTodo : t)),
                );
                this.hideForm();
            },
            error: (err) => console.error('Update todo failed:', err),
        });
    }

    deleteTodo(id: number): void {
        this.#todoService.deleteTodo(id).subscribe({
            next: () => {
                this._todos.update((todos) => todos.filter((t) => t.id !== id));
            },
            error: (err) => console.error('Delete todo failed:', err),
        });
    }

    toggleTodo(todo: Todo): void {
        this.#todoService
            .updateTodo(todo.id, { completed: !todo.completed })
            .subscribe({
                next: (updated) => {
                    this._todos.update((todos) =>
                        todos.map((t) => (t.id === todo.id ? updated : t)),
                    );
                },
                error: (err) => console.error('Toggle todo failed:', err),
            });
    }

    reorderTodo(id: number, newIndex: number): void {
        const currentTodos = this._todos();
        const todoIndex = currentTodos.findIndex((t) => t.id === id);
        if (todoIndex === -1) return;

        const updatedTodos = [...currentTodos];
        const [todoToMove] = updatedTodos.splice(todoIndex, 1);

        // Re-index all todos for full consistency
        updatedTodos.splice(newIndex, 0, todoToMove);
        const finalTodos = updatedTodos.map((t, idx) => ({ ...t, index: idx }));

        this._todos.set(finalTodos);

        this.#todoService.reorderTodo(id, newIndex).subscribe({
            next: (updatedTodo) => {
                this._todos.update((todos) =>
                    todos.map((t) =>
                        t.id === id ? { ...t, index: updatedTodo.index } : t,
                    ),
                );
            },
            error: () => {
                // Rollback on error
                this._todos.set(currentTodos);
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
        // Errors from resource are handled reactively
        console.error('TodoStore error:', message);
    }

    clearError(): void {
        // Resource errors clear on next successful reload
    }
}
