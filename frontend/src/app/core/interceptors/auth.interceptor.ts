import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject, Injector, PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../../features/auth/services/auth.service';
import { AuthStore } from '../store/auth.store';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    // Lazy inject to avoid circular dependency (AuthService → HttpClient → AuthInterceptor → AuthService)
    const injector = inject(Injector);
    const translateService = inject(TranslateService);
    const messageService = inject(MessageService);
    const router = inject(Router);
    const platformId = inject(PLATFORM_ID);
    const isBrowser = isPlatformBrowser(platformId);

    const authService = injector.get(AuthService);
    const accessToken = authService.getAccessToken();

    // Attach Authorization header for authenticated requests (skip auth endpoints
    // that don't need it and would create confusion).
    if (
        accessToken &&
        !req.url.includes('/auth/login') &&
        !req.url.includes('/auth/register')
    ) {
        req = req.clone({
            setHeaders: { Authorization: `Bearer ${accessToken}` },
            // withCredentials ensures the HttpOnly refresh cookie is sent when needed.
            withCredentials: true,
        });
    }

    return next(req).pipe(
        catchError((error: HttpErrorResponse) => {
            // Only handle 401 on the browser side and for non-auth endpoints.
            if (
                !isBrowser ||
                error.status !== 401 ||
                req.url.includes('/auth/login') ||
                req.url.includes('/auth/refresh')
            ) {
                return throwError(() => error);
            }

            // Access token expired — try silent refresh.
            // The browser will automatically include the HttpOnly refresh cookie.
            return authService.refreshToken().pipe(
                switchMap((newToken) => {
                    const retryReq = req.clone({
                        setHeaders: {
                            Authorization: `Bearer ${newToken.accessToken}`,
                        },
                        withCredentials: true,
                    });
                    return next(retryReq);
                }),
                catchError((refreshError) => {
                    const authStore = injector.get(AuthStore);
                    authStore.clearUser();
                    messageService.add({
                        severity: 'warn',
                        summary: translateService.instant(
                            'AUTH.ERRORS.SESSION_EXPIRED',
                        ),
                        detail: translateService.instant(
                            'AUTH.ERRORS.SESSION_EXPIRED_DETAIL',
                        ),
                        life: 5000,
                    });
                    router.navigate(['/login']);
                    return throwError(() => refreshError);
                }),
            );
        }),
    );
};
