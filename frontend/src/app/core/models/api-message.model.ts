import { HttpErrorResponse } from '@angular/common/http';

export interface ApiErrorDetail {
    messageCode: string;
}

export interface ApiError extends HttpErrorResponse {
    error: ApiErrorDetail;
}

export interface ApiSuccessResponse {
    message?: string;
}
