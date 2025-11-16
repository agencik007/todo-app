import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { AuthStateService } from '../services/auth-state.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const authStateService = inject(AuthStateService);
  const router = inject(Router);

  // Get access token
  const accessToken = authService.getAccessToken();

  // Clone request and add Authorization header if token exists
  if (accessToken && !req.url.includes('/auth/login') && !req.url.includes('/auth/register')) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${accessToken}`
      }
    });
  }

  // Handle request and response
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // If 401 Unauthorized and we have a refresh token, try to refresh
      if (error.status === 401 && !req.url.includes('/auth/refresh') && !req.url.includes('/auth/login')) {
        const refreshToken = authService.getRefreshToken();

        if (refreshToken) {
          return authService.refreshToken(refreshToken).pipe(
            switchMap((newToken) => {
              // Retry original request with new access token
              const clonedReq = req.clone({
                setHeaders: {
                  Authorization: `Bearer ${newToken.access_token}`
                }
              });
              return next(clonedReq);
            }),
            catchError((refreshError) => {
              // Refresh failed, logout user
              authStateService.clearUser();
              router.navigate(['/login']);
              return throwError(() => refreshError);
            })
          );
        } else {
          // No refresh token, logout user
          authStateService.clearUser();
          router.navigate(['/login']);
        }
      }

      return throwError(() => error);
    })
  );
};

