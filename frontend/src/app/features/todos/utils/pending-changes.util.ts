import { Todo, TodoUpdate } from '@api';
import { PendingTodoChange } from '../../../core/services/offline-data.service';

/** Id of the todo a change is about (temporary for a todo created offline). */
export function pendingTodoId(change: PendingTodoChange): number {
  return change.kind === 'create' ? change.todo.id : change.todoId;
}

/** Next temporary id: negative, so it never clashes with a server id. */
export function nextTempTodoId(changes: PendingTodoChange[]): number {
  const tempIds = changes
    .filter((change) => change.kind === 'create')
    .map((change) => change.todo.id);
  return Math.min(0, ...tempIds) - 1;
}

/** Only the fields an update actually sets. */
function setFields(changes: TodoUpdate): Partial<Todo> {
  return Object.fromEntries(
    Object.entries(changes).filter(([, value]) => value !== undefined),
  ) as Partial<Todo>;
}

/**
 * Adds a change to the queue, keeping one change per todo where it can: edits
 * of a todo created offline go into its create, edits of the same todo are
 * merged, and a delete replaces the edits, or drops the todo altogether when
 * it never reached the server. `inFlight` is being sent right now and is never
 * rewritten; a change to the same todo is queued after it instead.
 */
export function queueChange(
  changes: PendingTodoChange[],
  change: PendingTodoChange,
  inFlight: PendingTodoChange | null,
): PendingTodoChange[] {
  if (change.kind === 'create') {
    return [...changes, change];
  }

  const id = change.todoId;
  const queued = changes.find(
    (other) => other !== inFlight && pendingTodoId(other) === id,
  );

  if (change.kind === 'update') {
    if (!queued) {
      return [...changes, change];
    }
    if (queued.kind === 'delete') {
      return changes;
    }
    const merged: PendingTodoChange =
      queued.kind === 'create'
        ? {
            kind: 'create',
            todo: { ...queued.todo, ...setFields(change.changes) },
          }
        : {
            kind: 'update',
            todoId: id,
            changes: { ...queued.changes, ...change.changes },
          };
    return changes.map((other) => (other === queued ? merged : other));
  }

  const others = changes.filter(
    (other) => other === inFlight || pendingTodoId(other) !== id,
  );
  return queued?.kind === 'create' ? others : [...others, change];
}

/** The server's todos as they will be once the pending changes are sent. */
export function applyPendingChanges(
  todos: Todo[],
  changes: PendingTodoChange[],
): Todo[] {
  return changes.reduce((result, change) => {
    switch (change.kind) {
      case 'create':
        return result.some((todo) => todo.id === change.todo.id)
          ? result
          : [...result, change.todo];
      case 'update':
        return result.map((todo) =>
          todo.id === change.todoId
            ? { ...todo, ...setFields(change.changes) }
            : todo,
        );
      case 'delete':
        return result.filter((todo) => todo.id !== change.todoId);
    }
  }, todos);
}

/** Points the queued changes of a todo created offline at its server id. */
export function replaceTodoId(
  changes: PendingTodoChange[],
  tempId: number,
  id: number,
): PendingTodoChange[] {
  return changes.map((change) =>
    change.kind !== 'create' && change.todoId === tempId
      ? { ...change, todoId: id }
      : change,
  );
}
