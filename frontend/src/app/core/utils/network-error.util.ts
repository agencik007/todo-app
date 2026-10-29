import { HttpErrorResponse } from '@angular/common/http';
import { extractApiMessageCode } from './api-error.util';

/**
 * The API could not be reached: no connection (status 0), or a gateway with
 * no API behind it (502/503/504). Note that the Angular service worker turns
 * a failed network request into a synthetic 504 response, so with the
 * service worker active "offline" shows up as 504, not 0. A 503 that carries
 * an API message code (e.g. SUGGESTIONS_UNAVAILABLE) came from the API
 * itself, so the server is reachable.
 */
export function isServerUnreachable(error: unknown): boolean {
  return (
    error instanceof HttpErrorResponse &&
    [0, 502, 503, 504].includes(error.status) &&
    extractApiMessageCode(error) === null
  );
}
