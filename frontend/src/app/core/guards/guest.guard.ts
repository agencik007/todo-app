import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthStateService } from '../services/auth-state.service';

export const guestGuard: CanActivateFn = (route, state) => {
  const authStateService = inject(AuthStateService);
  const router = inject(Router);

  if (typeof window === 'undefined') {
    return true;
  }

  if (authStateService.isAuthenticated()) {
    router.navigate(['/todos']);
    return false;
  }

  return true;
};
