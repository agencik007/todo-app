import { HttpErrorResponse } from '@angular/common/http';

/**
 * The API could not be reached: no connection (status 0), or a gateway with
 * no API behind it (502/503/504). Note that the Angular service worker turns
 * a failed network request into a synthetic 504 response, so with the
 * service worker active "offline" shows up as 504, not 0.
 */
export function isServerUnreachable(error: unknown): boolean {
  return (
    error instanceof HttpErrorResponse &&
    [0, 502, 503, 504].includes(error.status)
  );
}
