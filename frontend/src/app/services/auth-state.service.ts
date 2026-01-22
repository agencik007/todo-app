import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { AuthService } from './auth.service';
import { IndexedDbService } from './indexed-db.service';
import { User } from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class AuthStateService {
  private authService = inject(AuthService);
  private indexedDbService = inject(IndexedDbService);

  // State signals
  readonly currentUser = signal<User | null>(null);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly isAuthenticated = signal<boolean>(this.authService.isAuthenticated());
  readonly userAvatar = signal<string | null>(null);

  constructor() {
    // Effect to handle authentication state changes
    effect(() => {
      const hasToken = this.authService.isAuthenticated();
      const hasUser = this.currentUser() !== null;

      // If token was removed but user still exists, clear user
      if (!hasToken && hasUser) {
        this.currentUser.set(null);
        this.isAuthenticated.set(false);
        this.userAvatar.set(null);
      }
    });
  }

  // Load user from API if token exists
  loadUserFromStorage(): void {
    // Only load in browser environment
    if (typeof window === 'undefined') {
      return;
    }

    if (this.authService.isAuthenticated()) {
      // Prevent multiple simultaneous loads
      if (this.isLoading()) {
        return;
      }

      this.isLoading.set(true);
      this.isAuthenticated.set(true); // Ensure it's true if we have a token

      this.authService.getCurrentUser().subscribe({
        next: (user) => {
          this.currentUser.set(user);
          this.isLoading.set(false);
          this.isAuthenticated.set(true);
          this.loadAvatar(); // Load avatar after user is loaded
        },
        error: (err) => {
          // Token might be invalid, clear it
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

  // Set user (called after successful login/register)
  setUser(user: User): void {
    this.currentUser.set(user);
    this.isAuthenticated.set(true);
    this.error.set(null);
    this.loadAvatar(); // Load avatar
  }

  // Clear user and tokens (called on logout)
  clearUser(): void {
    this.authService.logout();
    this.currentUser.set(null);
    this.isAuthenticated.set(false);
    this.error.set(null);
    this.userAvatar.set(null);
  }

  // Load avatar from IndexedDB
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
      console.error('Error loading avatar from IDB', e);
      this.userAvatar.set(null);
    }
  }

  // Set error message
  setError(message: string): void {
    this.error.set(message);
  }

  // Clear error message
  clearError(): void {
    this.error.set(null);
  }
}

