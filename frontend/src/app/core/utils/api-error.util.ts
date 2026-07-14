import { HttpErrorResponse } from '@angular/common/http';

/**
 * Backend errors carry a translation key either under
 * `error.detail.messageCode` (FastAPI HTTPException with an object detail)
 * or directly under `error.messageCode`. Every error handler used to
 * re-implement this lookup with `any` casts; use this instead and feed the
 * result to translate as `API_MESSAGES.<code>`.
 */
export function extractApiMessageCode(error: unknown): string | null {
    if (!(error instanceof HttpErrorResponse)) return null;

    const body: unknown = error.error;
    if (typeof body !== 'object' || body === null) return null;

    const detail = (body as { detail?: unknown }).detail;
    const fromDetail =
        typeof detail === 'object' && detail !== null
            ? (detail as { messageCode?: unknown }).messageCode
            : undefined;

    const code = fromDetail ?? (body as { messageCode?: unknown }).messageCode;
    return typeof code === 'string' ? code : null;
}
