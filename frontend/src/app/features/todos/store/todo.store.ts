import { HttpContext, HttpErrorResponse } from '@angular/common/http';
import {
  computed,
  effect,
  inject,
  Injectable,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { Todo, TodoCreate, TodoUpdate } from '@api';
import { TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { firstValueFrom } from 'rxjs';
import { SILENT_NOTIFICATIONS } from '../../../core/interceptors/notification.interceptor';
import { AppBadgeService } from '../../../core/services/app-badge.service';
import { NetworkStatusService } from '../../../core/services/network-status.service';
import {
  OfflineDataService,
  PendingTodoChange,
} from '../../../core/services/offline-data.service';
import { AuthStore } from '../../../core/store/auth.store';
import { extractApiMessageCode } from '../../../core/utils/api-error.util';
import { isServerUnreachable } from '../../../core/utils/network-error.util';
import { GroupStore } from '../../groups/store/group.store';
import { TodoService } from '../services/todo.service';
import {
  applyPendingChanges,
  nextTempTodoId,
  pendingTodoId,
  queueChange,
  replaceTodoId,
} from '../utils/pending-changes.util';

/** What became of one pending change sent to the server. */
type SendOutcome =
  | 'sent' // applied; next change
  | 'dropped' // rejected for good (e.g. the todo was deleted elsewhere)
  | 'again' // rewritten (group gone); send it again
  | 'retry' // server busy or failing; try again later
  | 'stop'; // offline or signed out; resumes when that changes

/**
 * TodoStore - Centralized state management for todos using Angular Signals.
 *
 * This store follows the Signal Store pattern with:
 * - httpResource for reactive data fetching
 * - linkedSignal for local mutations (optimistic updates) synchronized with resource
 * - Computed signals for derived state
 * - Methods for state mutations
 * - Offline: without server data (offline session, or a reload that failed
 *   offline) the last synced todos from OfflineDataService are shown, and
 *   every list the server confirms is saved there
 * - Offline changes: creating, editing, toggling and deleting a todo without
 *   a connection queues the change (OfflineDataService.pendingChanges); the
 *   list shows the server's todos with the queue applied, and the queue is
 *   sent in order once the server can be reached. Last write wins, a delete
 *   wins over edits, and while anything is queued new changes queue too, so
 *   they reach the server in the order they were made.
 */
@Injectable({
  providedIn: 'root',
})
export class TodoStore {
  readonly #todoService = inject(TodoService);
  readonly #groupStore = inject(GroupStore);
  readonly #authStore = inject(AuthStore);
  readonly #offlineData = inject(OfflineDataService);
  readonly #networkStatus = inject(NetworkStatusService);
  readonly #messageService = inject(MessageService);
  readonly #translate = inject(TranslateService);
  readonly #appBadge = inject(AppBadgeService);

  static readonly RETRY_DELAY_MS = 30_000;

  // Server todos synchronized with httpResource, allowing local mutations
  private readonly _serverTodos = linkedSignal<Todo[]>(() => {
    const resource = this.#todoService.todosResource;
    if (resource.hasValue()) {
      return resource.value();
    }
    // Tracks restore/login/logout of the snapshot, not every save.
    this.#offlineData.snapshot();
    return untracked(() => this.#offlineData.latestTodos());
  });
  // What the user sees: the server's todos with the queued changes applied.
  private readonly _todos = computed(() =>
    applyPendingChanges(
      this._serverTodos(),
      this.#offlineData.pendingChanges(),
    ),
  );
  private readonly _editingTodoId = signal<number | null>(null);
  private readonly _formVisible = signal(false);
  private readonly _saving = signal(false);

  // Public readonly signals
  readonly todos = this._todos;
  readonly loading = this.#todoService.todosResource.isLoading;
  readonly error = computed(() => {
    const err = this.#todoService.todosResource.error();
    // Offline isn't an error here: the offline banner explains it and the
    // last synced todos are shown instead.
    if (err && this.#networkStatus.online()) {
      return extractApiMessageCode(err) ?? err.message ?? 'An error occurred';
    }
    return null;
  });
  readonly formVisible = this._formVisible.asReadonly();
  /** The form's create/update request is in flight; hideForm() ends it. */
  readonly saving = this._saving.asReadonly();

  // Reactive filtering based on GroupStore selection
  readonly filteredTodos = computed(() => {
    const selectedIds = this.#groupStore.selectedGroupIds();
    const allTodos = this._todos();

    if (selectedIds.length === 0) {
      return allTodos;
    }

    return allTodos.filter((t) => t.groupId && selectedIds.includes(t.groupId));
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

  /** Number of changes waiting to be sent to the server. */
  readonly pendingCount = computed(
    () => this.#offlineData.pendingChanges().length,
  );
  /** Ids of the todos with changes waiting to be sent. */
  readonly pendingTodoIds = computed(
    () => new Set(this.#offlineData.pendingChanges().map(pendingTodoId)),
  );

  /** The change being sent; queueChange never rewrites it. */
  #inFlight: PendingTodoChange | null = null;
  #syncing = false;
  #retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Keep the offline copy in step with what the server has confirmed.
    effect(() => {
      const todos = this._serverTodos();
      if (
        this.#todoService.todosResource.hasValue() &&
        this.#authStore.canWrite()
      ) {
        untracked(() => this.#offlineData.saveTodos(todos));
      }
    });

    // Open tasks on the installed app's icon (if the user turned it on);
    // all of them, whatever groups are selected. Cleared on logout.
    effect(() => {
      const open = this.#authStore.hasSession()
        ? this._todos().filter((todo) => !todo.completed).length
        : 0;
      this.#appBadge.show(open);
    });

    // Send the queued changes once the server can be reached. Waits for a
    // running fetch, whose list could otherwise overwrite the sent changes.
    effect(() => {
      if (
        this.#authStore.canWrite() &&
        !this.#todoService.todosResource.isLoading() &&
        this.#offlineData.pendingChanges().length > 0
      ) {
        untracked(() => void this.#sendPendingChanges());
      }
    });
  }

  // ==================== Actions ====================

  loadTodos(): void {
    this.#todoService.todosResource.reload();
  }

  createTodo(todoData: TodoCreate): void {
    const todo = this.#newTodo(todoData);
    if (this.#mustQueue()) {
      this.#queue({ kind: 'create', todo });
      this.hideForm();
      return;
    }

    this._saving.set(true);
    this.#todoService
      .createTodo({ ...todoData, clientId: todo.clientId })
      .subscribe({
        next: (newTodo) => {
          this._serverTodos.update((todos) => [...todos, newTodo]);
          this.hideForm();
        },
        error: (err) => {
          if (!isServerUnreachable(err)) {
            console.error('Create todo failed:', err);
            this._saving.set(false);
            return;
          }
          // The connection dropped: queue it. The same clientId makes the
          // retry return this todo if the first request did get through.
          this.#queue({ kind: 'create', todo });
          this.hideForm();
        },
      });
  }

  updateTodo(id: number, update: TodoUpdate): void {
    this._saving.set(true);
    this.#update(id, update, () => this.hideForm());
  }

  deleteTodo(id: number): void {
    if (this.#mustQueue()) {
      this.#queue({ kind: 'delete', todoId: id });
      return;
    }

    this.#todoService.deleteTodo(id).subscribe({
      next: () => {
        this._serverTodos.update((todos) => todos.filter((t) => t.id !== id));
      },
      error: (err) => {
        if (!isServerUnreachable(err)) {
          console.error('Delete todo failed:', err);
          return;
        }
        this.#queue({ kind: 'delete', todoId: id });
      },
    });
  }

  toggleTodo(todo: Todo): void {
    this.#update(todo.id, { completed: !todo.completed });
  }

  #update(id: number, changes: TodoUpdate, done?: () => void): void {
    if (this.#mustQueue()) {
      this.#queue({ kind: 'update', todoId: id, changes });
      done?.();
      return;
    }

    this.#todoService.updateTodo(id, changes).subscribe({
      next: (updated) => {
        this._serverTodos.update((todos) =>
          todos.map((t) => (t.id === id ? updated : t)),
        );
        done?.();
      },
      error: (err) => {
        if (!isServerUnreachable(err)) {
          console.error('Update todo failed:', err);
          this._saving.set(false);
          return;
        }
        this.#queue({ kind: 'update', todoId: id, changes });
        done?.();
      },
    });
  }

  /** Online only, with nothing queued: the new index is the server's. */
  reorderTodo(id: number, newIndex: number): void {
    if (this.#mustQueue()) return;

    const currentTodos = this._serverTodos();
    const todoIndex = currentTodos.findIndex((t) => t.id === id);
    if (todoIndex === -1) return;

    const updatedTodos = [...currentTodos];
    const [todoToMove] = updatedTodos.splice(todoIndex, 1);

    // Re-index all todos for full consistency
    updatedTodos.splice(newIndex, 0, todoToMove);
    const finalTodos = updatedTodos.map((t, idx) => ({ ...t, index: idx }));

    this._serverTodos.set(finalTodos);

    this.#todoService.reorderTodo(id, newIndex).subscribe({
      next: (updatedTodo) => {
        this._serverTodos.update((todos) =>
          todos.map((t) =>
            t.id === id ? { ...t, index: updatedTodo.index } : t,
          ),
        );
      },
      error: () => {
        // Rollback on error
        this._serverTodos.set(currentTodos);
      },
    });
  }

  // ==================== Offline changes ====================

  /** Offline, or older changes still queued (they must go first). */
  #mustQueue(): boolean {
    return (
      !this.#authStore.canWrite() ||
      this.#offlineData.pendingChanges().length > 0
    );
  }

  #queue(change: PendingTodoChange): void {
    const pending = this.#offlineData.pendingChanges();
    if (change.kind === 'create') {
      // Numbered when queued, so two creates that failed together differ.
      change = {
        kind: 'create',
        todo: { ...change.todo, id: nextTempTodoId(pending) },
      };
    }
    this.#offlineData.setPendingChanges(
      queueChange(pending, change, this.#inFlight),
    );
  }

  /** A todo as shown until the server creates it (id set by #queue). */
  #newTodo(data: TodoCreate): Todo {
    const user = this.#authStore.currentUser();
    const todos = this._todos();
    const now = new Date().toISOString();
    return {
      ...data,
      id: 0,
      clientId: crypto.randomUUID(),
      userId: user?.id ?? 0,
      ownerEmail: user?.email ?? null,
      completed: data.completed ?? false,
      index: Math.max(-1, ...todos.map((t) => t.index ?? 0)) + 1,
      createdAt: now,
      updatedAt: now,
    };
  }

  /** Sends the queued changes one by one, oldest first. */
  async #sendPendingChanges(): Promise<void> {
    if (this.#syncing) {
      return;
    }
    this.#syncing = true;
    if (this.#retryTimer) {
      clearTimeout(this.#retryTimer);
      this.#retryTimer = null;
    }

    let sent = 0;
    let dropped = 0;
    try {
      while (this.#authStore.canWrite()) {
        const change = this.#offlineData.pendingChanges()[0];
        if (!change) {
          break;
        }
        this.#inFlight = change;
        const outcome = await this.#send(change);
        this.#inFlight = null;

        if (outcome === 'stop') {
          break;
        }
        if (outcome === 'retry') {
          this.#retryTimer = setTimeout(
            () => void this.#sendPendingChanges(),
            TodoStore.RETRY_DELAY_MS,
          );
          break;
        }
        if (outcome === 'again') {
          continue;
        }
        // A create that was rejected takes the later edits of its todo along.
        const droppedTodoId =
          outcome === 'dropped' && change.kind === 'create'
            ? change.todo.id
            : null;
        this.#offlineData.setPendingChanges(
          this.#offlineData
            .pendingChanges()
            .filter((c) => c !== change && pendingTodoId(c) !== droppedTodoId),
        );
        if (outcome === 'sent') {
          sent++;
        } else {
          dropped++;
        }
      }
    } finally {
      this.#inFlight = null;
      this.#syncing = false;
    }

    if (sent + dropped > 0 && this.#authStore.canWrite()) {
      // Pick up anything else that changed on the server meanwhile.
      this.loadTodos();
    }
    if (sent > 0 && this.#offlineData.pendingChanges().length === 0) {
      this.#messageService.add({
        severity: 'success',
        summary: this.#translate.instant('OFFLINE.SYNCED'),
        detail: this.#translate.instant('OFFLINE.SYNCED_DETAIL', {
          count: sent,
        }),
        life: 3000,
      });
    }
    if (dropped > 0) {
      this.#messageService.add({
        severity: 'warn',
        summary: this.#translate.instant('OFFLINE.SYNC_DROPPED'),
        detail: this.#translate.instant('OFFLINE.SYNC_DROPPED_DETAIL', {
          count: dropped,
        }),
        life: 6000,
      });
    }
  }

  async #send(change: PendingTodoChange): Promise<SendOutcome> {
    // The summary toasts above replace one toast per request.
    const context = new HttpContext().set(SILENT_NOTIFICATIONS, true);
    try {
      switch (change.kind) {
        case 'create': {
          const { todo } = change;
          const created = await firstValueFrom(
            this.#todoService.createTodo(
              {
                title: todo.title,
                description: todo.description,
                completed: todo.completed,
                groupId: todo.groupId,
                clientId: todo.clientId,
              },
              context,
            ),
          );
          this._serverTodos.update((todos) => [
            ...todos.filter((t) => t.id !== created.id),
            created,
          ]);
          this.#offlineData.setPendingChanges(
            replaceTodoId(
              this.#offlineData.pendingChanges(),
              todo.id,
              created.id,
            ),
          );
          if (this._editingTodoId() === todo.id) {
            this._editingTodoId.set(created.id);
          }
          return 'sent';
        }
        case 'update': {
          const updated = await firstValueFrom(
            this.#todoService.updateTodo(
              change.todoId,
              change.changes,
              context,
            ),
          );
          this._serverTodos.update((todos) =>
            todos.map((t) => (t.id === updated.id ? updated : t)),
          );
          return 'sent';
        }
        case 'delete':
          await firstValueFrom(
            this.#todoService.deleteTodo(change.todoId, context),
          );
          this.#removeServerTodo(change.todoId);
          return 'sent';
      }
    } catch (error) {
      return this.#handleSendError(change, error);
    }
  }

  #handleSendError(change: PendingTodoChange, error: unknown): SendOutcome {
    if (
      isServerUnreachable(error) ||
      !(error instanceof HttpErrorResponse) ||
      error.status === 401 ||
      error.status === 403
    ) {
      // Offline, or the session ended (the auth interceptor handles that).
      return 'stop';
    }
    if (error.status === 429 || error.status >= 500) {
      return 'retry';
    }

    const code = extractApiMessageCode(error);
    if (change.kind === 'delete' && error.status === 404) {
      this.#removeServerTodo(change.todoId);
      return 'sent'; // already gone
    }
    if (code === 'GROUP_NOT_FOUND') {
      // The group was deleted elsewhere: keep the todo, without the group.
      if (change.kind === 'create' && change.todo.groupId != null) {
        this.#rewrite(change, {
          kind: 'create',
          todo: { ...change.todo, groupId: null },
        });
        return 'again';
      }
      if (change.kind === 'update' && change.changes.groupId != null) {
        this.#rewrite(change, {
          ...change,
          changes: { ...change.changes, groupId: null },
        });
        return 'again';
      }
    }
    if (change.kind === 'update' && error.status === 404) {
      this.#removeServerTodo(change.todoId); // deleted elsewhere
    }
    console.error('Pending change rejected:', change, error);
    return 'dropped';
  }

  #rewrite(change: PendingTodoChange, replacement: PendingTodoChange): void {
    this.#offlineData.setPendingChanges(
      this.#offlineData
        .pendingChanges()
        .map((c) => (c === change ? replacement : c)),
    );
  }

  #removeServerTodo(id: number): void {
    this._serverTodos.update((todos) => todos.filter((t) => t.id !== id));
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
    this._saving.set(false);
  }

  setError(message: string): void {
    // Errors from resource are handled reactively
    console.error('TodoStore error:', message);
  }

  clearError(): void {
    // Resource errors clear on next successful reload
  }
}
