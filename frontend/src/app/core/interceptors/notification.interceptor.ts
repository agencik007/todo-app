import { isPlatformBrowser } from '@angular/common';
import {
  HttpContextToken,
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpResponse,
} from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { catchError, tap, throwError } from 'rxjs';
import { NetworkStatusService } from '../services/network-status.service';
import { API_URL } from '../tokens/api-url.token';
import { extractApiMessageCode } from '../utils/api-error.util';
import { isServerUnreachable } from '../utils/network-error.util';

/**
 * Set on requests whose caller reports the outcome itself (e.g. sending the
 * changes made offline), so they don't raise a toast each.
 */
export const SILENT_NOTIFICATIONS = new HttpContextToken<boolean>(() => false);

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

  const networkStatus = inject(NetworkStatusService);
  const isApiRequest = req.url.startsWith(inject(API_URL));
  const silent = req.context.get(SILENT_NOTIFICATIONS);

  return next(req).pipe(
    tap((event) => {
      // Handle success responses with message code
      if (event instanceof HttpResponse) {
        if (isApiRequest) {
          networkStatus.reportReachable();
        }
        if (silent) {
          return;
        }
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
            detail: translateService.instant(`API_MESSAGES.${messageCode}`),
            life: 3000,
          });
        }
      }
    }),
    catchError((error: HttpErrorResponse) => {
      // Unreachable (offline, or no API behind the gateway): read-only mode.
      // Any other status means the API answered.
      if (isApiRequest) {
        if (isServerUnreachable(error)) {
          networkStatus.reportUnreachable();
        } else {
          networkStatus.reportReachable();
        }
      }

      // Handle error responses with messageCode
      const messageCode = extractApiMessageCode(error);

      // Nie pokazujemy globalnego błędu dla wygaśnięcia sesji,
      // ponieważ auth.interceptor obsługuje to osobnym tostem ostrzegawczym.
      if (
        !silent &&
        messageCode &&
        messageCode !== 'AUTH_INVALID_REFRESH_TOKEN'
      ) {
        messageService.add({
          severity: 'error',
          summary: translateService.instant('MESSAGES.ERROR'),
          detail: translateService.instant(`API_MESSAGES.${messageCode}`),
          life: 5000,
        });
      }
      return throwError(() => error);
    }),
  );
};
