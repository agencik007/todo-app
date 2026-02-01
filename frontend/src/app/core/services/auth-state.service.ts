import { Injectable, effect, inject, signal } from '@angular/core';
import { UserResponse as User } from '@api';
import { UsersService } from '@api/api/users.service';
import { AuthService } from '../../features/auth/services/auth.service';
import { IndexedDbService } from './indexed-db.service';
import { LanguageService } from './language.service';

@Injectable({
    providedIn: 'root',
})
export class AuthStateService {
    private authService = inject(AuthService);
    private indexedDbService = inject(IndexedDbService);
    private languageService = inject(LanguageService);
    private usersService = inject(UsersService);

    readonly currentUser = signal<User | null>(null);
    readonly isLoading = signal(false);
    readonly error = signal<string | null>(null);
    readonly isAuthenticated = signal<boolean>(false);
    readonly userAvatar = signal<string | null>(null);
    readonly isInitialized = signal<boolean>(false);

    constructor() {
        // Sync isAuthenticated signal with service
        if (typeof window !== 'undefined') {
            this.isAuthenticated.set(this.authService.isAuthenticated());
        }

        effect(() => {
            const hasToken = this.authService.isAuthenticated();
            const hasUser = this.currentUser() !== null;
            if (!hasToken && hasUser) {
                this.currentUser.set(null);
                this.isAuthenticated.set(false);
                this.userAvatar.set(null);
            }
        });
    }

    async initializeAuth(): Promise<void> {
        if (typeof window === 'undefined') {
            this.isInitialized.set(true);
            return;
        }

        if (this.authService.isAuthenticated()) {
            this.isLoading.set(true);
            this.isAuthenticated.set(true);

            return new Promise((resolve) => {
                this.authService.getCurrentUser().subscribe({
                    next: (user) => {
                        this.currentUser.set(user);
                        this.isAuthenticated.set(true);

                        // Backend -> Frontend Sync
                        if (user.language) {
                            this.languageService.setLanguage(user.language);
                        }

                        if (user.avatar_url) {
                            this.authService
                                .fetchAndCacheAvatar(user.avatar_url)
                                .subscribe({
                                    next: () => {
                                        this.loadAvatar();
                                        this.isLoading.set(false);
                                        this.isInitialized.set(true);
                                        resolve();
                                    },
                                    error: () => {
                                        this.loadAvatar();
                                        this.isLoading.set(false);
                                        this.isInitialized.set(true);
                                        resolve();
                                    },
                                });
                        } else {
                            this.loadAvatar();
                            this.isLoading.set(false);
                            this.isInitialized.set(true);
                            resolve();
                        }
                    },
                    error: () => {
                        this.authService.logout();
                        this.currentUser.set(null);
                        this.isAuthenticated.set(false);
                        this.isLoading.set(false);
                        this.userAvatar.set(null);
                        this.isInitialized.set(true);
                        resolve();
                    },
                });
            });
        } else {
            this.isAuthenticated.set(false);
            this.isInitialized.set(true);
        }
    }

    loadUserFromStorage(): void {
        this.initializeAuth();
    }

    setUser(user: User): void {
        this.currentUser.set(user);
        this.isAuthenticated.set(true);
        this.error.set(null);

        // Backend -> Frontend Sync
        if (user.language) {
            this.languageService.setLanguage(user.language);
        }

        if (user.avatar_url) {
            this.authService.fetchAndCacheAvatar(user.avatar_url).subscribe({
                next: () => this.loadAvatar(),
                error: () => this.loadAvatar(),
            });
        } else {
            this.loadAvatar();
        }
    }

    clearUser(): void {
        this.authService.logout();
        this.currentUser.set(null);
        this.isAuthenticated.set(false);
        this.error.set(null);
        this.userAvatar.set(null);
    }

    async loadAvatar(): Promise<void> {
        try {
            const blob = await this.indexedDbService.getAvatar();
            if (blob) {
                const url = URL.createObjectURL(blob);
                this.userAvatar.set(url);
            } else {
                this.userAvatar.set(null);
            }
        } catch {
            this.userAvatar.set(null);
        }
    }

    setError(message: string): void {
        this.error.set(message);
    }

    clearError(): void {
        this.error.set(null);
    }

    syncLanguage(lang: string): void {
        if (this.isAuthenticated()) {
            this.usersService
                .updateLanguageUsersMeLanguagePut({ language: lang })
                .subscribe({
                    error: (err: any) =>
                        console.error('Failed to sync language', err),
                });
        }
    }
}
