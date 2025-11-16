import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { AuthService } from './auth.service';
import { User } from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class AuthStateService {
  private authService = inject(AuthService);

  // State signals
  readonly currentUser = signal<User | null>(null);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  // Computed signals - check token first, then user data
  readonly isAuthenticated = computed(() => {
    const hasToken = this.authService.isAuthenticated();
    // If token exists, user is authenticated (even if user data is still loading)
    return hasToken;
  });

  constructor() {
    // Effect to handle authentication state changes
    effect(() => {
      const hasToken = this.authService.isAuthenticated();
      const hasUser = this.currentUser() !== null;

      // If token was removed but user still exists, clear user
      if (!hasToken && hasUser) {
        this.currentUser.set(null);
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
      this.authService.getCurrentUser().subscribe({
        next: (user) => {
          this.currentUser.set(user);
          this.isLoading.set(false);
        },
        error: (err) => {
          // Token might be invalid, clear it
          this.authService.logout();
          this.currentUser.set(null);
          this.isLoading.set(false);
        }
      });
    }
  }

  // Set user (called after successful login/register)
  setUser(user: User): void {
    this.currentUser.set(user);
    this.error.set(null);
  }

  // Clear user and tokens (called on logout)
  clearUser(): void {
    this.authService.logout();
    this.currentUser.set(null);
    this.error.set(null);
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

