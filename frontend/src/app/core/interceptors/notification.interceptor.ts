import { isPlatformBrowser } from '@angular/common';
import {
    HttpErrorResponse,
    HttpInterceptorFn,
    HttpResponse,
} from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { catchError, tap, throwError } from 'rxjs';
import { extractApiMessageCode } from '../utils/api-error.util';

function extractSuccessMessageCode(body: unknown): string | null {
    if (typeof body !== 'object' || body === null) return null;
    const message = (body as { message?: unknown }).message;
    return typeof message === 'string' ? message : null;
}

export const notificationInterceptor: HttpInterceptorFn = (req, next) => {
    const messageService = inject(MessageService);
    const translateService = inject(TranslateService);
    const platformId = inject(PLATFORM_ID);
    const isBrowser = isPlatformBrowser(platformId);

    if (!isBrowser) {
        return next(req);
    }

    return next(req).pipe(
        tap((event) => {
            // Handle success responses with message code
            if (event instanceof HttpResponse) {
                const messageCode = extractSuccessMessageCode(event.body);
                // Only show toasts for specific message types to avoid spamming
                if (
                    messageCode &&
                    (messageCode.startsWith('AUTH_') ||
                        messageCode.startsWith('TODO_') ||
                        messageCode.startsWith('USER_'))
                ) {
                    messageService.add({
                        severity: 'success',
                        summary: translateService.instant('MESSAGES.SUCCESS'),
                        detail: translateService.instant(
                            `API_MESSAGES.${messageCode}`,
                        ),
                        life: 3000,
                    });
                }
            }
        }),
        catchError((error: HttpErrorResponse) => {
            // Handle error responses with messageCode
            const messageCode = extractApiMessageCode(error);

            // Nie pokazujemy globalnego błędu dla wygaśnięcia sesji,
            // ponieważ auth.interceptor obsługuje to osobnym tostem ostrzegawczym.
            if (messageCode && messageCode !== 'AUTH_INVALID_REFRESH_TOKEN') {
                messageService.add({
                    severity: 'error',
                    summary: translateService.instant('MESSAGES.ERROR'),
                    detail: translateService.instant(
                        `API_MESSAGES.${messageCode}`,
                    ),
                    life: 5000,
                });
            }
            return throwError(() => error);
        }),
    );
};
