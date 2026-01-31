import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthStateService } from '../services/auth-state.service';

export const guestGuard: CanActivateFn = () => {
  const authStateService = inject(AuthStateService);
  const router = inject(Router);

  if (authStateService.isAuthenticated()) {
    return router.parseUrl('/todos');
  }

  return true;
};
