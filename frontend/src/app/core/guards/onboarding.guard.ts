import { isPlatformServer } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '../store/auth.store';

/**
 * Sends a user who hasn't picked starter groups yet to /welcome. Only an
 * explicit `false` counts: a user object cached by an older frontend
 * (offline snapshot) has no flag and must pass.
 */
export const onboardingGuard: CanActivateFn = () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (isPlatformServer(inject(PLATFORM_ID))) {
    return true;
  }

  return authStore.currentUser()?.onboardingCompleted === false
    ? router.parseUrl('/welcome')
    : true;
};

/** Keeps /welcome for users who haven't finished onboarding. */
export const welcomeGuard: CanActivateFn = () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (isPlatformServer(inject(PLATFORM_ID))) {
    return true;
  }

  return authStore.currentUser()?.onboardingCompleted !== false
    ? router.parseUrl('/todos')
    : true;
};
