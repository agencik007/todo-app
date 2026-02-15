import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
    AuthService as ApiAuthService,
    UsersService as ApiUsersService,
    UserCreate as LoginRequest,
    PasswordReset,
    PasswordResetRequest,
    RefreshTokenRequest,
    UserCreate as RegisterRequest,
    Token,
    UserResponse as User,
} from '@api';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { IndexedDbService } from '../../../core/services/indexed-db.service';
import { API_URL } from '../../../core/tokens/api-url.token';

@Injectable({
    providedIn: 'root',
})
export class AuthService {
    private http = inject(HttpClient);
    private apiAuthService = inject(ApiAuthService);
    private apiUsersService = inject(ApiUsersService);
    private indexedDbService = inject(IndexedDbService);
    private baseApiUrl = inject(API_URL);
    private apiUrl = `${this.baseApiUrl}/auth`;

    register(userData: RegisterRequest): Observable<User> {
        return this.apiAuthService
            .registerAuthRegisterPost(userData)
            .pipe(catchError(this.handleError));
    }

    login(loginData: LoginRequest): Observable<Token> {
        // Keeping manual login for now due to generated API missing body param for this endpoint
        // (FastAPI signature issue with supporting both JSON and Form Data)
        return this.http.post<Token>(`${this.apiUrl}/login`, loginData).pipe(
            tap((token) => this.setTokens(token)),
            catchError(this.handleError),
        );
    }

    refreshToken(refreshToken: string): Observable<Token> {
        const request: RefreshTokenRequest = { refresh_token: refreshToken };
        return this.apiAuthService
            .refreshAccessTokenAuthRefreshPost(request)
            .pipe(
                tap((token) => this.setTokens(token)),
                catchError(this.handleError),
            );
    }

    getCurrentUser(): Observable<User> {
        return this.apiAuthService
            .getCurrentUserInfoAuthMeGet()
            .pipe(catchError(this.handleError));
    }

    fetchAndCacheAvatar(url: string): Observable<Blob> {
        const fullUrl = `${this.baseApiUrl}${url}`;
        return this.http.get(fullUrl, { responseType: 'blob' }).pipe(
            tap((blob) => {
                // Save both the blob and the URL for cache validation
                this.indexedDbService.saveAvatar(blob);
                this.indexedDbService.saveAvatarUrl(url);
            }),
            catchError(this.handleError),
        );
    }

    forgotPassword(
        request: PasswordResetRequest,
    ): Observable<{ message: string }> {
        return this.apiAuthService
            .forgotPasswordAuthForgotPasswordPost(request)
            .pipe(catchError(this.handleError));
    }

    resetPassword(resetData: PasswordReset): Observable<{ message: string }> {
        return this.apiAuthService
            .resetPasswordAuthResetPasswordPost(resetData)
            .pipe(catchError(this.handleError));
    }

    verifyEmail(token: string): Observable<{ message: string }> {
        return this.apiAuthService
            .verifyEmailAuthVerifyEmailTokenGet(token)
            .pipe(catchError(this.handleError));
    }

    resendVerification(): Observable<{ message: string }> {
        return this.apiAuthService
            .resendVerificationAuthResendVerificationPost()
            .pipe(catchError(this.handleError));
    }

    uploadAvatar(file: File): Observable<{ avatar_url: string }> {
        return this.apiUsersService.uploadAvatarUsersMeAvatarPost(file).pipe(
            tap((response) => {
                if (response.avatar_url) this.indexedDbService.saveAvatar(file);
            }),
            catchError(this.handleError),
        );
    }

    deleteAvatar(): Observable<{ message: string }> {
        return this.apiUsersService.deleteAvatarUsersMeAvatarDelete().pipe(
            tap(() => this.indexedDbService.deleteAvatar()),
            catchError(this.handleError),
        );
    }

    logout(): Observable<any> {
        return this.apiAuthService.logoutAuthLogoutPost().pipe(
            tap(() => {
                this.clearTokens();
            }),
            catchError((err) => {
                this.clearTokens();
                return throwError(() => err);
            }),
        );
    }

    getAccessToken(): string | null {
        if (typeof window === 'undefined') return null;
        return localStorage.getItem('access_token');
    }

    getRefreshToken(): string | null {
        if (typeof window === 'undefined') return null;
        return localStorage.getItem('refresh_token');
    }

    private setTokens(token: Token): void {
        if (typeof window === 'undefined') return;
        localStorage.setItem('access_token', token.access_token);
        localStorage.setItem('refresh_token', token.refresh_token);
    }

    clearTokens(): void {
        if (typeof window === 'undefined') return;
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
    }

    isAuthenticated(): boolean {
        if (typeof window === 'undefined') return false;
        const token = this.getAccessToken();
        return token !== null && token.trim() !== '';
    }

    private handleError(error: HttpErrorResponse): Observable<never> {
        let errorMessage = 'An unknown error occurred!';
        if (error.error instanceof ErrorEvent) {
            errorMessage = `Error: ${error.error.message}`;
        } else {
            errorMessage =
                error.error?.detail ||
                `Error Code: ${error.status}\nMessage: ${error.message}`;
        }
        return throwError(() => new Error(errorMessage));
    }
}
