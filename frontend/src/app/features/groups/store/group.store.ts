import { computed, inject, Injectable, signal } from '@angular/core';
import { Group, GroupCreate, GroupsService, GroupUpdate } from '@api';
import { OfflineDataService } from '../../../core/services/offline-data.service';
import { AuthStore } from '../../../core/store/auth.store';
import { extractApiMessageCode } from '../../../core/utils/api-error.util';
import { isServerUnreachable } from '../../../core/utils/network-error.util';

/**
 * GroupStore - Centralized state management for groups using Angular Signals.
 *
 * This store follows the Signal Store pattern with:
 * - Private writable signals for internal state
 * - Public readonly signals for consumers
 * - Computed signals for derived state
 * - Methods for state mutations
 * - Offline: groups come from OfflineDataService when the server can't be
 *   reached, and every list the server confirms is saved there
 */
@Injectable({
  providedIn: 'root',
})
export class GroupStore {
  readonly #groupsService = inject(GroupsService);
  readonly #authStore = inject(AuthStore);
  readonly #offlineData = inject(OfflineDataService);

  // Private writable state signals
  readonly #groups = signal<Group[]>([]);
  readonly #loading = signal(false);
  readonly #error = signal<string | null>(null);
  readonly #selectedGroupIds = signal<Set<number>>(new Set());

  // Public readonly signals (exposed to components)
  readonly groups = this.#groups.asReadonly();
  readonly loading = this.#loading.asReadonly();
  readonly error = this.#error.asReadonly();

  // Multi-select: array of selected group IDs
  readonly selectedGroupIds = computed(() =>
    Array.from(this.#selectedGroupIds()),
  );

  // Dialog state
  readonly #dialogVisible = signal(false);
  readonly #editingGroup = signal<Group | null>(null);

  readonly dialogVisible = this.#dialogVisible.asReadonly();
  readonly editingGroup = this.#editingGroup.asReadonly();

  // Check if any groups are selected
  readonly hasSelection = computed(() => this.#selectedGroupIds().size > 0);

  // Computed signals for derived state
  readonly selectedGroups = computed(() =>
    this.#groups().filter((g) => this.#selectedGroupIds().has(g.id)),
  );

  readonly groupsCount = computed(() => this.#groups().length);

  readonly hasGroups = computed(() => this.#groups().length > 0);

  // For backwards compatibility - returns first selected group id or null
  readonly selectedGroupId = computed(() => {
    const ids = this.selectedGroupIds();
    return ids.length > 0 ? ids[0] : null;
  });

  // ==================== Actions ====================

  #setSyncedGroups(groups: Group[]): void {
    this.#groups.set(groups);
    this.#offlineData.saveGroups(groups);
  }

  loadGroups(): void {
    this.#error.set(null);

    if (this.#authStore.isOfflineSession()) {
      this.#groups.set(this.#offlineData.latestGroups());
      return;
    }

    this.#loading.set(true);
    this.#groupsService.getGroupsGroupsGet().subscribe({
      next: (groups) => {
        this.#setSyncedGroups(groups);
        this.#loading.set(false);
      },
      error: (err: unknown) => {
        if (isServerUnreachable(err)) {
          // Offline: show the last synced groups instead of an error.
          this.#groups.set(this.#offlineData.latestGroups());
          this.#loading.set(false);
          return;
        }
        this.#error.set(
          extractApiMessageCode(err) ??
            (err instanceof Error ? err.message : null) ??
            'Failed to load groups',
        );
        this.#loading.set(false);
      },
    });
  }

  /** Resolves with the created group, or `null` when the request failed. */
  createGroup(groupData: GroupCreate): Promise<Group | null> {
    return new Promise((resolve) => {
      this.#groupsService.createGroupGroupsPost(groupData).subscribe({
        next: (newGroup) => {
          this.#setSyncedGroups([...this.#groups(), newGroup]);
          this.closeDialog();
          resolve(newGroup);
        },
        error: (err: Error) => {
          this.#error.set(err.message);
          resolve(null);
        },
      });
    });
  }

  updateGroup(id: number, update: GroupUpdate): void {
    this.#groupsService.updateGroupGroupsGroupIdPut(id, update).subscribe({
      next: (updatedGroup) => {
        this.#setSyncedGroups(
          this.#groups().map((g) => (g.id === id ? updatedGroup : g)),
        );
        this.closeDialog();
      },
      error: (err: Error) => {
        this.#error.set(err.message);
      },
    });
  }

  deleteGroup(id: number): void {
    this.#groupsService.deleteGroupGroupsGroupIdDelete(id).subscribe({
      next: () => {
        this.#setSyncedGroups(this.#groups().filter((g) => g.id !== id));
        // Clear from selection if deleted
        this.#selectedGroupIds.update((set) => {
          const newSet = new Set(set);
          newSet.delete(id);
          return newSet;
        });
      },
      error: (err: Error) => {
        this.#error.set(err.message);
      },
    });
  }

  // ==================== Dialog Actions ====================

  showCreateDialog(): void {
    this.#editingGroup.set(null);
    this.#dialogVisible.set(true);
  }

  showEditDialog(group: Group): void {
    this.#editingGroup.set(group);
    this.#dialogVisible.set(true);
  }

  closeDialog(): void {
    this.#dialogVisible.set(false);
    this.#editingGroup.set(null);
  }

  // ==================== Selection Actions ====================

  /**
   * Toggle selection of a single group (for checkbox behavior)
   */
  toggleGroupSelection(id: number): void {
    this.#selectedGroupIds.update((set) => {
      const newSet = new Set(set);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }

  /**
   * Check if a group is selected
   */
  isGroupSelected(id: number): boolean {
    return this.#selectedGroupIds().has(id);
  }

  /**
   * Select a single group (clears other selections) - for backwards compat
   */
  selectGroup(id: number | null): void {
    if (id === null) {
      this.clearSelection();
    } else {
      this.#selectedGroupIds.set(new Set([id]));
    }
  }

  /**
   * Clear all selections
   */
  clearSelection(): void {
    this.#selectedGroupIds.set(new Set());
  }

  setError(message: string): void {
    this.#error.set(message);
  }

  clearError(): void {
    this.#error.set(null);
  }
}
