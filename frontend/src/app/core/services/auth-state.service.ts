import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { AuthService } from '../../features/auth/services/auth.service';
import { IndexedDbService } from './indexed-db.service';
import { User } from '../../features/auth/models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class AuthStateService {
  private authService = inject(AuthService);
  private indexedDbService = inject(IndexedDbService);

  readonly currentUser = signal<User | null>(null);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly isAuthenticated = signal<boolean>(this.authService.isAuthenticated());
  readonly userAvatar = signal<string | null>(null);

  constructor() {
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

  loadUserFromStorage(): void {
    if (typeof window === 'undefined') return;
    if (this.authService.isAuthenticated()) {
      if (this.isLoading()) return;
      this.isLoading.set(true);
      this.isAuthenticated.set(true);
      this.authService.getCurrentUser().subscribe({
        next: (user) => {
          this.currentUser.set(user);
          this.isLoading.set(false);
          this.isAuthenticated.set(true);
          this.loadAvatar();
        },
        error: (err) => {
          this.authService.logout();
          this.currentUser.set(null);
          this.isAuthenticated.set(false);
          this.isLoading.set(false);
          this.userAvatar.set(null);
        }
      });
    } else {
      this.isAuthenticated.set(false);
    }
  }

  setUser(user: User): void {
    this.currentUser.set(user);
    this.isAuthenticated.set(true);
    this.error.set(null);
    this.loadAvatar();
  }

  clearUser(): void {
    this.authService.logout();
    this.currentUser.set(null);
    this.isAuthenticated.set(false);
    this.error.set(null);
    this.userAvatar.set(null);
  }

  async loadAvatar() {
    try {
      const blob = await this.indexedDbService.getAvatar();
      if (blob) {
        const url = URL.createObjectURL(blob);
        this.userAvatar.set(url);
      } else {
        this.userAvatar.set(null);
      }
    } catch (e) {
      this.userAvatar.set(null);
    }
  }

  setError(message: string): void {
    this.error.set(message);
  }

  clearError(): void {
    this.error.set(null);
  }
}
