import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import {
    AuthService as ApiAuthService,
    UsersService as ApiUsersService,
    PasswordReset,
    PasswordResetRequest,
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

    // Access token lives only in memory — never persisted to localStorage/sessionStorage.
    // The refresh token is an HttpOnly cookie managed entirely by the browser.
    private readonly _accessToken = signal<string | null>(null);

    register(userData: RegisterRequest): Observable<User> {
        return this.apiAuthService
            .registerAuthRegisterPost(userData)
            .pipe(catchError(this.handleError));
    }

    login(loginData: { email: string; password: string }): Observable<Token> {
        // Manual call to support both JSON and Form Data formats on the same endpoint.
        // withCredentials: true is required so the browser stores the HttpOnly
        // refresh token cookie returned by Set-Cookie.
        return this.http
            .post<Token>(`${this.apiUrl}/login`, loginData, {
                withCredentials: true,
            })
            .pipe(
                tap((token) => this._setAccessToken(token)),
                catchError(this.handleError),
            );
    }

    refreshToken(): Observable<Token> {
        // No body needed — the browser sends the HttpOnly cookie automatically.
        // withCredentials: true ensures the cookie is included in the request.
        return this.http
            .post<Token>(
                `${this.apiUrl}/refresh`,
                {},
                { withCredentials: true },
            )
            .pipe(
                tap((token) => this._setAccessToken(token)),
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

    verifyEmail(token: string): Observable<unknown> {
        return this.apiAuthService
            .verifyEmailAuthVerifyEmailTokenGet(token)
            .pipe(catchError(this.handleError));
    }

    resendVerification(): Observable<{ message: string }> {
        return this.apiAuthService
            .resendVerificationAuthResendVerificationPost()
            .pipe(catchError(this.handleError));
    }

    uploadAvatar(file: File): Observable<{ avatarUrl: string }> {
        return this.apiUsersService.uploadAvatarUsersMeAvatarPost(file).pipe(
            tap((response: { avatarUrl: string }) => {
                if (response.avatarUrl) this.indexedDbService.saveAvatar(file);
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

    logout(): Observable<unknown> {
        // withCredentials: true so the browser sends the refresh cookie and
        // the backend can clear it via Set-Cookie: Max-Age=0.
        return this.http
            .post(`${this.apiUrl}/logout`, {}, { withCredentials: true })
            .pipe(
                tap(() => this.clearTokens()),
                catchError((err) => {
                    this.clearTokens();
                    return throwError(() => err);
                }),
            );
    }

    getAccessToken(): string | null {
        return this._accessToken();
    }

    clearTokens(): void {
        this._accessToken.set(null);
    }

    isAuthenticated(): boolean {
        const token = this._accessToken();
        return token !== null && token.trim() !== '';
    }

    private _setAccessToken(token: Token): void {
        this._accessToken.set(token.accessToken);
    }

    private handleError(error: HttpErrorResponse): Observable<never> {
        return throwError(() => error);
    }
}
