import { effect, inject, Injectable, signal } from '@angular/core';
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

    constructor() {
        // Sync isAuthenticated signal with service on browser
        if (typeof window !== 'undefined') {
            this._isAuthenticated.set(this.authService.isAuthenticated());
        }

        // Effect to clear user when token is lost
        effect(() => {
            const hasToken = this.authService.isAuthenticated();
            const hasUser = this._currentUser() !== null;
            if (!hasToken && hasUser) {
                this.clearUser();
            }
        });
    }

    // ==================== Initialization ====================

    async initializeAuth(): Promise<void> {
        if (typeof window === 'undefined') {
            // During SSR, we don't mark as initialized to avoid flickering
            // as we can't determine the auth state without localStorage.
            return;
        }

        if (this.authService.isAuthenticated()) {
            this._isLoading.set(true);
            this._isAuthenticated.set(true);

            return new Promise((resolve) => {
                this.authService.getCurrentUser().subscribe({
                    next: (user) => {
                        this._currentUser.set(user);
                        this._isAuthenticated.set(true);

                        // Backend -> Frontend Sync
                        if (user.language) {
                            this.languageService.setLanguage(user.language);
                        }

                        // Try to load avatar from cache first
                        this.loadAvatarWithCacheCheck(user.avatar_url).then(
                            () => {
                                this._isLoading.set(false);
                                this._isInitialized.set(true);
                                resolve();
                            },
                        );
                    },
                    error: () => {
                        this.clearUser();
                        this._isLoading.set(false);
                        this._isInitialized.set(true);
                        resolve();
                    },
                });
            });
        } else {
            this._isAuthenticated.set(false);
            this._isInitialized.set(true);
        }
    }

    loadUserFromStorage(): void {
        this.initializeAuth();
    }

    // ==================== User Management ====================

    async setUser(user: User): Promise<string | null> {
        this._currentUser.set(user);
        this._isAuthenticated.set(true);
        this._error.set(null);

        // Backend -> Frontend Sync
        if (user.language) {
            this.languageService.setLanguage(user.language);
        }

        // Load avatar with cache check and return the URL
        await this.loadAvatarWithCacheCheck(user.avatar_url);
        return this._userAvatar();
    }

    /**
     * Clear all user-related state signals and local tokens.
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
     * 1. Notifies backend (while tokens are still present)
     * 2. Clears local tokens and signals
     */
    logout(): void {
        // 1. Notify backend while tokens are still in localStorage
        this.authService.logout().subscribe();

        // 2. Clear signals and tokens immediately for UI responsiveness
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
            // No avatar URL - clear cache and signal
            await this.indexedDbService.deleteAvatar();
            this._userAvatar.set(null);
            return;
        }

        try {
            // Check if we have a cached avatar
            const cachedBlob = await this.indexedDbService.getAvatar();
            const cachedUrl = await this.indexedDbService.getAvatarUrl();

            if (cachedBlob && cachedUrl === avatarUrl) {
                // Cache hit! Use cached avatar
                const blobUrl = URL.createObjectURL(cachedBlob);
                this._userAvatar.set(blobUrl);
                return;
            }

            // Cache miss or URL changed - fetch from server
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
