import { inject, Injectable, signal } from '@angular/core';
import { Group, Todo, TodoUpdate, UserResponse } from '@api';
import { IndexedDbService } from './indexed-db.service';

/** The signed-in user's last synced data, kept for offline use. */
export interface OfflineSnapshot {
  userId: number;
  user: UserResponse;
  todos: Todo[];
  groups: Group[];
  /** ISO time of the last write of data that came from the server. */
  savedAt: string;
}

/**
 * A todo change made while the server couldn't be reached, waiting to be sent.
 * A todo created offline has a temporary negative id until the server answers;
 * its clientId makes a retried create return the same todo.
 */
export type PendingTodoChange =
  | { kind: 'create'; todo: Todo }
  | { kind: 'update'; todoId: number; changes: TodoUpdate }
  | { kind: 'delete'; todoId: number };

interface StoredPendingChanges {
  userId: number;
  changes: PendingTodoChange[];
}

const SNAPSHOT_KEY = 'snapshot';
const PENDING_CHANGES_KEY = 'pendingChanges';

/**
 * Keeps one snapshot of the signed-in user's data in IndexedDB so the app can
 * show it when it starts without a connection, plus the todo changes made
 * offline that still have to reach the server.
 *
 * Only one user's data is ever stored: starting a session for another user
 * replaces it, and AuthStore clears it on logout and account deletion. When a
 * session expires the snapshot is cleared but the pending changes are kept, so
 * they are sent once the same user signs in again. Nothing is ever shared
 * through the service worker cache, which is keyed by URL and not by user.
 */
@Injectable({
  providedIn: 'root',
})
export class OfflineDataService {
  readonly #indexedDb = inject(IndexedDbService);

  static readonly SAVE_DELAY_MS = 300;

  /** Snapshot restored at startup or started at login; null after clear(). */
  readonly #snapshot = signal<OfflineSnapshot | null>(null);
  readonly snapshot = this.#snapshot.asReadonly();

  readonly #lastSyncedAt = signal<string | null>(null);
  readonly lastSyncedAt = this.#lastSyncedAt.asReadonly();

  readonly #pendingChanges = signal<PendingTodoChange[]>([]);
  /** Todo changes waiting to be sent, oldest first. */
  readonly pendingChanges = this.#pendingChanges.asReadonly();
  /** Owner of pendingChanges; null without a session. */
  #pendingUserId: number | null = null;

  // Latest data, written to IndexedDB after a short delay. Kept outside the
  // signals so saving never feeds back into the stores that read them.
  #current: OfflineSnapshot | null = null;
  #saveTimer: ReturnType<typeof setTimeout> | null = null;

  #scheduleSave(): void {
    if (this.#saveTimer) {
      clearTimeout(this.#saveTimer);
    }
    this.#saveTimer = setTimeout(() => {
      this.#saveTimer = null;
      if (this.#current) {
        this.#indexedDb
          .putOffline(SNAPSHOT_KEY, this.#current)
          .catch((error: unknown) =>
            console.error('Saving offline data failed', error),
          );
      }
    }, OfflineDataService.SAVE_DELAY_MS);
  }

  #update(patch: Partial<Pick<OfflineSnapshot, 'todos' | 'groups'>>): void {
    if (!this.#current) {
      return;
    }
    const savedAt = new Date().toISOString();
    this.#current = { ...this.#current, ...patch, savedAt };
    this.#lastSyncedAt.set(savedAt);
    this.#scheduleSave();
  }

  /** Loads the stored snapshot (app start without a connection). */
  async restore(): Promise<OfflineSnapshot | null> {
    const stored = await this.#indexedDb
      .getOffline<OfflineSnapshot>(SNAPSHOT_KEY)
      .catch(() => null);
    this.#current = stored;
    this.#snapshot.set(stored);
    this.#lastSyncedAt.set(stored?.savedAt ?? null);
    if (stored) {
      await this.#loadPendingChanges(stored.userId);
    }
    return stored;
  }

  /** Loads the user's pending changes; another user's are deleted. */
  async #loadPendingChanges(userId: number): Promise<void> {
    if (this.#pendingUserId === userId) {
      return; // already loaded, and newer than what is stored
    }
    const stored = await this.#indexedDb
      .getOffline<StoredPendingChanges>(PENDING_CHANGES_KEY)
      .catch(() => null);
    if (stored && stored.userId !== userId) {
      await this.#indexedDb
        .deleteOffline(PENDING_CHANGES_KEY)
        .catch(() => null);
    }
    this.#pendingUserId = userId;
    this.#pendingChanges.set(stored?.userId === userId ? stored.changes : []);
  }

  /**
   * Starts saving for a signed-in user. Data of any other user is deleted
   * first, so one account never sees another's tasks on a shared device.
   */
  async start(user: UserResponse): Promise<void> {
    const stored =
      this.#current ??
      (await this.#indexedDb
        .getOffline<OfflineSnapshot>(SNAPSHOT_KEY)
        .catch(() => null));

    if (stored?.userId === user.id) {
      this.#current = { ...stored, user };
    } else {
      if (stored) {
        await this.#indexedDb.deleteOffline(SNAPSHOT_KEY).catch(() => null);
      }
      this.#current = {
        userId: user.id,
        user,
        todos: [],
        groups: [],
        savedAt: new Date().toISOString(),
      };
    }
    this.#snapshot.set(this.#current);
    this.#lastSyncedAt.set(this.#current.savedAt);
    this.#scheduleSave();
    await this.#loadPendingChanges(user.id);
  }

  /** Latest saved todos (read when the server can't be reached). */
  latestTodos(): Todo[] {
    return this.#current?.todos ?? [];
  }

  /** Latest saved groups (read when the server can't be reached). */
  latestGroups(): Group[] {
    return this.#current?.groups ?? [];
  }

  /** Saves todos that came from (or were confirmed by) the server. */
  saveTodos(todos: Todo[]): void {
    this.#update({ todos });
  }

  /** Saves groups that came from (or were confirmed by) the server. */
  saveGroups(groups: Group[]): void {
    this.#update({ groups });
  }

  /**
   * Replaces the pending changes and stores them right away, so a change
   * survives the app being closed. Ignored without a session.
   */
  setPendingChanges(changes: PendingTodoChange[]): void {
    if (this.#pendingUserId === null) {
      return;
    }
    this.#pendingChanges.set(changes);
    const stored: StoredPendingChanges = {
      userId: this.#pendingUserId,
      changes,
    };
    this.#indexedDb
      .putOffline(PENDING_CHANGES_KEY, stored)
      .catch((error: unknown) =>
        console.error('Saving pending changes failed', error),
      );
  }

  /**
   * Deletes everything stored for offline use. With keepPendingChanges (the
   * session expired) the changes not sent yet stay on the device for the next
   * sign-in of the same user.
   */
  async clear({ keepPendingChanges = false } = {}): Promise<void> {
    if (this.#saveTimer) {
      clearTimeout(this.#saveTimer);
      this.#saveTimer = null;
    }
    this.#current = null;
    this.#snapshot.set(null);
    this.#lastSyncedAt.set(null);
    this.#pendingUserId = null;
    this.#pendingChanges.set([]);
    await this.#indexedDb.deleteOffline(SNAPSHOT_KEY).catch(() => null);
    if (!keepPendingChanges) {
      await this.#indexedDb
        .deleteOffline(PENDING_CHANGES_KEY)
        .catch(() => null);
    }
  }
}
