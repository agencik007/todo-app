import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthStateService } from '../services/auth-state.service';
import { AuthService } from '../services/auth.service';

export const guestGuard: CanActivateFn = (route, state) => {
  const authStateService = inject(AuthStateService);
  const authService = inject(AuthService);
  const router = inject(Router);

  // In SSR environment, always allow navigation (client-side guard will handle it)
  if (typeof window === 'undefined') {
    return true;
  }

  // Check if user has token (even if user data is still loading)
  if (authService.isAuthenticated()) {
    // If token exists but user is not loaded yet, try to load it
    if (!authStateService.currentUser() && !authStateService.isLoading()) {
      authStateService.loadUserFromStorage();
    }
    router.navigate(['/todos']);
    return false;
  }

  // Allow access if user is not authenticated
  return true;
};

