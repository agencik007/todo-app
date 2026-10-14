import { inject, Injectable, signal } from '@angular/core';
import { Group, Todo, UserResponse } from '@api';
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

const SNAPSHOT_KEY = 'snapshot';

/**
 * Keeps one snapshot of the signed-in user's data in IndexedDB so the app can
 * show it read-only when it starts without a connection.
 *
 * Only one user's data is ever stored: starting a session for another user
 * replaces it, and AuthStore clears it on logout, an expired session and
 * account deletion. It is never shared through the service worker cache,
 * which is keyed by URL and not by user.
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
    return stored;
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

  /** Deletes everything stored for offline use. */
  async clear(): Promise<void> {
    if (this.#saveTimer) {
      clearTimeout(this.#saveTimer);
      this.#saveTimer = null;
    }
    this.#current = null;
    this.#snapshot.set(null);
    this.#lastSyncedAt.set(null);
    await this.#indexedDb.deleteOffline(SNAPSHOT_KEY).catch(() => null);
  }
}
