import {
  computed,
  effect,
  inject,
  Injectable,
  signal,
  untracked,
} from '@angular/core';
import { Router } from '@angular/router';
import { UserResponse as User } from '@api';
import { UsersService } from '@api/api/users.service';
import { firstValueFrom, switchMap } from 'rxjs';
import { AuthService } from '../../features/auth/services/auth.service';
import { IndexedDbService } from '../services/indexed-db.service';
import { LanguageService } from '../services/language.service';
import { NetworkStatusService } from '../services/network-status.service';
import { OfflineDataService } from '../services/offline-data.service';
import { isServerUnreachable } from '../utils/network-error.util';

/**
 * AuthStore - Centralized authentication state management using Angular Signals.
 *
 * This store manages:
 * - Current user data
 * - Authentication status
 * - User avatar
 * - Loading and error states
 * - Language synchronization
 * - Offline sessions: when the app starts without a connection, the last
 *   synced data of the previous user is shown read-only (OfflineDataService)
 *   until the server can be reached again
 */
@Injectable({
  providedIn: 'root',
})
export class AuthStore {
  private authService = inject(AuthService);
  private indexedDbService = inject(IndexedDbService);
  private languageService = inject(LanguageService);
  private usersService = inject(UsersService);
  readonly #networkStatus = inject(NetworkStatusService);
  readonly #offlineData = inject(OfflineDataService);
  readonly #router = inject(Router);

  // Private writable state signals
  private readonly _currentUser = signal<User | null>(null);
  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _isAuthenticated = signal(false);
  private readonly _userAvatar = signal<string | null>(null);
  private readonly _isInitialized = signal(false);
  readonly #isOfflineSession = signal(false);

  // Public readonly signals
  readonly currentUser = this._currentUser.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly isAuthenticated = this._isAuthenticated.asReadonly();
  readonly userAvatar = this._userAvatar.asReadonly();
  readonly isInitialized = this._isInitialized.asReadonly();

  /** Started offline: the user and their data come from the offline snapshot. */
  readonly isOfflineSession = this.#isOfflineSession.asReadonly();

  /** A signed-in user, online or offline: show their pages and menu. */
  readonly hasSession = computed(
    () => this._isAuthenticated() || this.#isOfflineSession(),
  );

  /** Changes need the server: a real session and a reachable API. */
  readonly canWrite = computed(
    () => this._isAuthenticated() && this.#networkStatus.online(),
  );

  #isResuming = false;

  constructor() {
    // Back online during an offline session: restore the real session.
    effect(() => {
      if (this.#networkStatus.online() && this.#isOfflineSession()) {
        untracked(() => this.#resumeSession());
      }
    });
  }

  // ==================== Initialization ====================

  /**
   * Called during APP_INITIALIZER. Attempts a silent token refresh using the
   * HttpOnly cookie. If the cookie is valid, fetches the current user and
   * restores the session. If not, marks the user as unauthenticated.
   *
   * This replaces the old localStorage-based check — there is no access token
   * to read on page load; the only source of truth is the refresh cookie.
   */
  async initializeAuth(): Promise<void> {
    if (typeof window === 'undefined') {
      // SSR: cannot access cookies or user state here.
      return;
    }

    this._isLoading.set(true);
    try {
      await this.#restoreSession();
    } finally {
      this._isLoading.set(false);
      this._isInitialized.set(true);
    }
  }

  /**
   * Refresh token, then the profile. Without a connection, falls back to the
   * offline snapshot; any other failure (no or expired refresh cookie) means
   * no session, and the data stored for the previous user is wiped.
   */
  async #restoreSession(): Promise<void> {
    try {
      // The HttpOnly refresh cookie buys a new access token (kept in memory).
      await firstValueFrom(this.authService.refreshToken());
      const user = await firstValueFrom(this.authService.getCurrentUser());
      await this.setUser(user);
    } catch (error) {
      if (isServerUnreachable(error) && (await this.#startOfflineSession())) {
        return;
      }
      if (isServerUnreachable(error)) {
        this._isAuthenticated.set(false);
        return;
      }
      this.clearUser();
    }
  }

  /** Shows the last synced data read-only. False when there is none. */
  async #startOfflineSession(): Promise<boolean> {
    const snapshot = await this.#offlineData.restore();
    if (!snapshot) {
      return false;
    }

    this._currentUser.set(snapshot.user);
    this.#isOfflineSession.set(true);
    if (snapshot.user.language) {
      this.languageService.setLanguage(snapshot.user.language);
    }
    await this.loadAvatarFromCache();
    return true;
  }

  /** Online again: swap the offline session for a real one, or log out. */
  #resumeSession(): void {
    if (this.#isResuming) {
      return;
    }
    this.#isResuming = true;

    this.authService
      .refreshToken()
      .pipe(switchMap(() => this.authService.getCurrentUser()))
      .subscribe({
        next: (user) => {
          this.#isResuming = false;
          void this.setUser(user);
        },
        error: (error: unknown) => {
          this.#isResuming = false;
          if (isServerUnreachable(error)) {
            return; // still unreachable; NetworkStatusService retries
          }
          // The session ended while offline (expired or revoked).
          this.clearUser();
          void this.#router.navigate(['/login']);
        },
      });
  }

  // ==================== User Management ====================

  async setUser(user: User): Promise<string | null> {
    this._currentUser.set(user);
    this._isAuthenticated.set(true);
    this.#isOfflineSession.set(false);
    this._error.set(null);
    // Replaces any other user's offline data before this user's is saved.
    await this.#offlineData.start(user);

    if (user.language) {
      this.languageService.setLanguage(user.language);
    }

    await this.loadAvatarWithCacheCheck(user.avatarUrl);
    return this._userAvatar();
  }

  /**
   * Clear all user-related state signals and the in-memory access token, and
   * delete everything stored on the device for offline use (logout, expired
   * session, deleted account).
   */
  clearUser(): void {
    this.authService.clearTokens();
    this._currentUser.set(null);
    this._isAuthenticated.set(false);
    this.#isOfflineSession.set(false);
    this._error.set(null);
    this._userAvatar.set(null);
    void this.#offlineData.clear();
    void this.indexedDbService.deleteAvatar();
  }

  /**
   * Performs a full logout:
   * 1. Notifies the backend (which clears the refresh cookie via Set-Cookie)
   * 2. Clears the in-memory access token and all UI signals
   */
  logout(): void {
    // Notify backend first — it will clear the HttpOnly refresh cookie.
    this.authService.logout().subscribe();

    // Clear signals and in-memory token immediately for UI responsiveness.
    this.clearUser();
  }

  // ==================== Avatar Management ====================

  /**
   * Load avatar with intelligent cache check.
   * Only fetches from server if:
   * - No cached avatar exists
   * - Avatar URL has changed
   */
  private async loadAvatarWithCacheCheck(
    avatarUrl: string | null | undefined,
  ): Promise<void> {
    if (!avatarUrl) {
      await this.indexedDbService.deleteAvatar();
      this._userAvatar.set(null);
      return;
    }

    try {
      const cachedBlob = await this.indexedDbService.getAvatar();
      const cachedUrl = await this.indexedDbService.getAvatarUrl();

      if (cachedBlob && cachedUrl === avatarUrl) {
        const blobUrl = URL.createObjectURL(cachedBlob);
        this._userAvatar.set(blobUrl);
        return;
      }

      this.authService.fetchAndCacheAvatar(avatarUrl).subscribe({
        next: () => this.loadAvatarFromCache(),
        error: () => this.loadAvatarFromCache(),
      });
    } catch {
      this._userAvatar.set(null);
    }
  }

  private async loadAvatarFromCache(): Promise<void> {
    try {
      const blob = await this.indexedDbService.getAvatar();
      if (blob) {
        const url = URL.createObjectURL(blob);
        this._userAvatar.set(url);
      } else {
        this._userAvatar.set(null);
      }
    } catch {
      this._userAvatar.set(null);
    }
  }

  async loadAvatar(): Promise<void> {
    await this.loadAvatarFromCache();
  }

  // ==================== Error Management ====================

  setError(message: string): void {
    this._error.set(message);
  }

  clearError(): void {
    this._error.set(null);
  }

  // ==================== Language Sync ====================

  syncLanguage(lang: string): void {
    if (this._isAuthenticated()) {
      this.usersService
        .updateLanguageUsersMeLanguagePut({ language: lang })
        .subscribe({
          error: (err: unknown) =>
            console.error('Failed to sync language', err),
        });
    }
  }
}
