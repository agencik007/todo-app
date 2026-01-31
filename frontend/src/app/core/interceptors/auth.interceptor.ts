import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { catchError, switchMap, throwError, of } from 'rxjs';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../features/auth/services/auth.service';
import { AuthStateService } from '../services/auth-state.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const authStateService = inject(AuthStateService);
  const messageService = inject(MessageService);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);
  const isBrowser = isPlatformBrowser(platformId);

  const accessToken = authService.getAccessToken();

  if (accessToken && !req.url.includes('/auth/login') && !req.url.includes('/auth/register')) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${accessToken}`
      }
    });
  }

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Don't handle 401 on server side or for auth endpoints
      if (!isBrowser || error.status !== 401 || req.url.includes('/auth/login') || req.url.includes('/auth/refresh')) {
        return throwError(() => error);
      }

      const refreshToken = authService.getRefreshToken();
      if (refreshToken) {
        return authService.refreshToken(refreshToken).pipe(
          switchMap((newToken) => {
            const clonedReq = req.clone({
              setHeaders: {
                Authorization: `Bearer ${newToken.access_token}`
              }
            });
            return next(clonedReq);
          }),
          catchError((refreshError) => {
            authStateService.clearUser();
            messageService.add({
              severity: 'warn',
              summary: 'Session Expired',
              detail: 'Your session has expired. Please login again.',
              life: 5000
            });
            router.navigate(['/login']);
            return throwError(() => refreshError);
          })
        );
      } else {
        authStateService.clearUser();
        messageService.add({
          severity: 'warn',
          summary: 'Session Expired',
          detail: 'Your session has expired. Please login again.',
          life: 5000
        });
        router.navigate(['/login']);
        return throwError(() => error);
      }
    })
  );
};
