import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { IndexedDbService } from '../../../core/services/indexed-db.service';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import {
  Token,
  LoginRequest,
  RegisterRequest,
  PasswordResetRequest,
  PasswordReset,
  RefreshTokenRequest,
  User
} from '../models/auth.model';

import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private indexedDbService = inject(IndexedDbService);
  private apiUrl = `${environment.apiUrl}/auth`;

  constructor() {}

  register(userData: RegisterRequest): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}/register`, userData).pipe(catchError(this.handleError));
  }

  login(loginData: LoginRequest): Observable<Token> {
    return this.http.post<Token>(`${this.apiUrl}/login`, loginData).pipe(
      tap(token => this.setTokens(token)),
      catchError(this.handleError)
    );
  }

  refreshToken(refreshToken: string): Observable<Token> {
    const request: RefreshTokenRequest = { refresh_token: refreshToken };
    return this.http.post<Token>(`${this.apiUrl}/refresh`, request).pipe(
      tap(token => this.setTokens(token)),
      catchError(this.handleError)
    );
  }

  getCurrentUser(): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/me`).pipe(
      catchError(this.handleError)
    );
  }

  fetchAndCacheAvatar(url: string): Observable<Blob> {
    const baseUrl = this.apiUrl.replace('/auth', '');
    const fullUrl = `${baseUrl}${url}`;
    return this.http.get(fullUrl, { responseType: 'blob' }).pipe(
      tap((blob) => this.indexedDbService.saveAvatar(blob)),
      catchError(this.handleError)
    );
  }


  forgotPassword(request: PasswordResetRequest): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/forgot-password`, request).pipe(catchError(this.handleError));
  }

  resetPassword(resetData: PasswordReset): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/reset-password`, resetData).pipe(catchError(this.handleError));
  }

  verifyEmail(token: string): Observable<{ message: string }> {
    return this.http.get<{ message: string }>(`${this.apiUrl}/verify-email/${token}`).pipe(catchError(this.handleError));
  }

  resendVerification(): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/resend-verification`, {}).pipe(catchError(this.handleError));
  }

  uploadAvatar(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const baseUrl = this.apiUrl.replace('/auth', '');
    return this.http.post<{ avatar_url: string }>(`${baseUrl}/users/me/avatar`, formData).pipe(
      tap(response => { if (response.avatar_url) this.indexedDbService.saveAvatar(file); })
    );
  }

  deleteAvatar() {
    const baseUrl = this.apiUrl.replace('/auth', '');
    return this.http.delete(`${baseUrl}/users/me/avatar`).pipe(tap(() => this.indexedDbService.deleteAvatar()));
  }

  logout(): void {
    this.clearTokens();
    this.indexedDbService.deleteAvatar();
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

  private clearTokens(): void {
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
      errorMessage = error.error?.detail || `Error Code: ${error.status}\nMessage: ${error.message}`;
    }
    return throwError(() => new Error(errorMessage));
  }
}
