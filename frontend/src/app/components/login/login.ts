import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { AuthStateService } from '../../services/auth-state.service';
import { LoginRequest } from '../../models/auth.model';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private authStateService = inject(AuthStateService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  loginForm: FormGroup;
  error = signal<string | null>(null);
  isLoading = signal(false);

  constructor() {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]]
    });
  }

  onSubmit() {
    if (this.loginForm.invalid) {
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    const loginData: LoginRequest = {
      email: this.loginForm.value.email,
      password: this.loginForm.value.password
    };

    this.authService.login(loginData).subscribe({
      next: () => {
        // Load user data
        this.authService.getCurrentUser().subscribe({
          next: (user) => {
            this.authStateService.setUser(user);
            this.isLoading.set(false);
            
            // Redirect to return URL or default to /todos
            const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/todos';
            this.router.navigate([returnUrl]);
          },
          error: (err) => {
            this.error.set('Nie udało się załadować danych użytkownika');
            this.isLoading.set(false);
          }
        });
      },
      error: (err) => {
        this.error.set(err.message || 'Nieprawidłowy email lub hasło');
        this.isLoading.set(false);
      }
    });
  }

  get email() {
    return this.loginForm.get('email');
  }

  get password() {
    return this.loginForm.get('password');
  }
}

