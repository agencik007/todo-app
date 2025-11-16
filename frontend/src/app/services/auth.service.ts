import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import {
  User,
  Token,
  LoginRequest,
  RegisterRequest,
  PasswordResetRequest,
  PasswordReset,
  RefreshTokenRequest
} from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private apiUrl: string;

  constructor() {
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
        // Store tokens in localStorage
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
        // Update tokens in localStorage
        this.setTokens(token);
      }),
      catchError(this.handleError)
    );
  }

  // Get current user info
  getCurrentUser(): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/me`).pipe(
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

  // Logout (clear tokens)
  logout(): void {
    this.clearTokens();
  }

  // Token management
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

  // Check if user is authenticated (has access token)
  isAuthenticated(): boolean {
    // Check if we're in browser environment
    if (typeof window === 'undefined') {
      return false;
    }
    const token = this.getAccessToken();
    return token !== null && token.trim() !== '';
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An unknown error occurred!';

    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Server-side error
      if (error.error && error.error.detail) {
        errorMessage = error.error.detail;
      } else {
        errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
      }
    }

    return throwError(() => new Error(errorMessage));
  }
}

