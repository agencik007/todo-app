import { inject, Injectable, signal } from '@angular/core';
import { UserResponse as User } from '@api';
import { UsersService } from '@api/api/users.service';
import { AuthService } from '../../features/auth/services/auth.service';
import { IndexedDbService } from '../services/indexed-db.service';
import { LanguageService } from '../services/language.service';

/**
 * AuthStore - Centralized authentication state management using Angular Signals.
 *
 * This store manages:
 * - Current user data
 * - Authentication status
 * - User avatar
 * - Loading and error states
 * - Language synchronization
 */
@Injectable({
    providedIn: 'root',
})
export class AuthStore {
    private authService = inject(AuthService);
    private indexedDbService = inject(IndexedDbService);
    private languageService = inject(LanguageService);
    private usersService = inject(UsersService);

    // Private writable state signals
    private readonly _currentUser = signal<User | null>(null);
    private readonly _isLoading = signal(false);
    private readonly _error = signal<string | null>(null);
    private readonly _isAuthenticated = signal(false);
    private readonly _userAvatar = signal<string | null>(null);
    private readonly _isInitialized = signal(false);

    // Public readonly signals
    readonly currentUser = this._currentUser.asReadonly();
    readonly isLoading = this._isLoading.asReadonly();
    readonly error = this._error.asReadonly();
    readonly isAuthenticated = this._isAuthenticated.asReadonly();
    readonly userAvatar = this._userAvatar.asReadonly();
    readonly isInitialized = this._isInitialized.asReadonly();

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

        return new Promise((resolve) => {
            this.authService.refreshToken().subscribe({
                next: () => {
                    // Refresh succeeded — new access token is now in memory.
                    // Fetch user profile to restore the session.
                    this.authService.getCurrentUser().subscribe({
                        next: (user) => {
                            this._currentUser.set(user);
                            this._isAuthenticated.set(true);

                            if (user.language) {
                                this.languageService.setLanguage(user.language);
                            }

                            this.loadAvatarWithCacheCheck(user.avatarUrl).then(
                                () => {
                                    this._isLoading.set(false);
                                    this._isInitialized.set(true);
                                    resolve();
                                },
                            );
                        },
                        error: () => {
                            // Access token was refreshed but /me failed — clear state.
                            this.clearUser();
                            this._isLoading.set(false);
                            this._isInitialized.set(true);
                            resolve();
                        },
                    });
                },
                error: () => {
                    // No valid refresh cookie — user is not authenticated.
                    this._isAuthenticated.set(false);
                    this._isLoading.set(false);
                    this._isInitialized.set(true);
                    resolve();
                },
            });
        });
    }

    // ==================== User Management ====================

    async setUser(user: User): Promise<string | null> {
        this._currentUser.set(user);
        this._isAuthenticated.set(true);
        this._error.set(null);

        if (user.language) {
            this.languageService.setLanguage(user.language);
        }

        await this.loadAvatarWithCacheCheck(user.avatarUrl);
        return this._userAvatar();
    }

    /**
     * Clear all user-related state signals and the in-memory access token.
     */
    clearUser(): void {
        this.authService.clearTokens();
        this._currentUser.set(null);
        this._isAuthenticated.set(false);
        this._error.set(null);
        this._userAvatar.set(null);
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
