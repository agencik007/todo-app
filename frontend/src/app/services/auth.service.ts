import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { IndexedDbService } from './indexed-db.service';
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

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private indexedDbService = inject(IndexedDbService);
  // Circular dependency warning: AuthStateService injects AuthService.
  // We should probably move state management fully to AuthStateService or keep AuthService stateless regarding UI state.
  // However, for caching logic which is "service" logic, we can keep it here but maybe expose a method to get the blob URL.
  // Better yet, let's just return the blob URL or handle the side effect in AuthStateService?
  // Actually, the plan says AuthService handles fetching and caching.
  // Let's inject AuthStateService lazily or use a different approach if needed.
  // For now, let's assume we can use a Subject or just update IndexedDB and let AuthStateService load from it?
  // Or we can just inject it, Angular handles circular deps better now with `inject` sometimes, but safer to avoid.
  // Let's NOT inject AuthStateService here. Let's return Observables and let the caller (AuthStateService or Component) handle the state update.
  // BUT, we need to update the avatar signal.
  // Let's add a `avatarUrl$` subject or similar if we want to be reactive, OR just let AuthStateService call `loadAvatar`.

  private apiUrl: string;

  constructor() {
    // ... existing constructor code ...
    // Dynamic API URL based on current location (SSR-safe)
    let hostname: string;
    let port: string;

    // Check if we're in browser environment (client-side)
    if (typeof window !== 'undefined') {
      hostname = window.location.hostname;
      port = window.location.port;
    } else {
      // Server-side rendering - fallback to environment or default
      hostname = process.env['HOSTNAME'] || 'localhost';
      port = process.env['PORT'] || '4200';
    }

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      // Local development
      this.apiUrl = 'http://localhost:8000/auth';
    } else {
      // Production - use same hostname but backend port
      this.apiUrl = `http://${hostname}:8000/auth`;
    }
  }

  // ... existing methods ...

  // Register new user
  register(userData: RegisterRequest): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}/register`, userData).pipe(
      catchError(this.handleError)
    );
  }

  // Login and get tokens
  login(loginData: LoginRequest): Observable<Token> {
    return this.http.post<Token>(`${this.apiUrl}/login/json`, loginData).pipe(
      tap((token) => {
        this.setTokens(token);
      }),
      catchError(this.handleError)
    );
  }

  // Refresh access token
  refreshToken(refreshToken: string): Observable<Token> {
    const request: RefreshTokenRequest = { refresh_token: refreshToken };
    return this.http.post<Token>(`${this.apiUrl}/refresh`, request).pipe(
      tap((token) => {
        this.setTokens(token);
      }),
      catchError(this.handleError)
    );
  }

  // Get current user info
  getCurrentUser(): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/me`).pipe(
      tap(user => {
        if (user.avatar_url) {
          this.fetchAndCacheAvatar(user.avatar_url);
        }
      }),
      catchError(this.handleError)
    );
  }

  // Request password reset
  forgotPassword(request: PasswordResetRequest): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/forgot-password`, request).pipe(
      catchError(this.handleError)
    );
  }

  // Reset password with token
  resetPassword(resetData: PasswordReset): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/reset-password`, resetData).pipe(
      catchError(this.handleError)
    );
  }

  // Upload Avatar
  uploadAvatar(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const baseUrl = this.apiUrl.replace('/auth', '');
    return this.http.post<{ avatar_url: string }>(`${baseUrl}/users/me/avatar`, formData).pipe(
      tap(response => {
        if (response.avatar_url) {
          // Cache the new avatar immediately
          // We can use the file object directly since we just uploaded it!
          this.indexedDbService.saveAvatar(file);
        }
      })
    );
  }

  // Delete Avatar
  deleteAvatar() {
    const baseUrl = this.apiUrl.replace('/auth', '');
    return this.http.delete(`${baseUrl}/users/me/avatar`).pipe(
      tap(() => {
        this.indexedDbService.deleteAvatar();
      })
    );
  }

  // Fetch avatar from backend and cache it
  private fetchAndCacheAvatar(url: string) {
    // Construct full URL
    // url from DB is like /uploads/1/avatar.png
    // We need http://localhost:8000/uploads/1/avatar.png
    // We can derive base from apiUrl
    const baseUrl = this.apiUrl.replace('/auth', '');
    const fullUrl = `${baseUrl}${url}`;

    this.http.get(fullUrl, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        this.indexedDbService.saveAvatar(blob);
      },
      error: (err) => console.error('Failed to fetch avatar for caching', err)
    });
  }

  // Logout (clear tokens)
  logout(): void {
    this.clearTokens();
    this.indexedDbService.deleteAvatar(); // Clear cached avatar on logout
  }

  // ... token management methods ...
  getAccessToken(): string | null {
    if (typeof window === 'undefined') {
      return null;
    }
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
    if (typeof window === 'undefined') {
      return false;
    }
    const token = this.getAccessToken();
    return token !== null && token.trim() !== '';
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An unknown error occurred!';

    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error: ${error.error.message}`;
    } else {
      if (error.error && error.error.detail) {
        errorMessage = error.error.detail;
      } else {
        errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
      }
    }

    return throwError(() => new Error(errorMessage));
  }
}
