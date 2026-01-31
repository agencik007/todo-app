import { Component, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { AuthStateService } from '../../../../core/services/auth-state.service';
import { LoginRequest } from '../../models/auth.model';
import { MessageService } from 'primeng/api';

// PrimeNG
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';

@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule,
    RouterModule,
    CardModule,
    InputTextModule,
    PasswordModule,
    ButtonModule,
    MessageModule,
    NgClass
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private authStateService = inject(AuthStateService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private messageService = inject(MessageService);

  loginForm: FormGroup;
  error = signal<string | null>(null);
  isLoading = signal(false);

  constructor() {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]]
    });

    const verified = this.route.snapshot.queryParams['verified'];
    if (verified === 'success') {
      setTimeout(() => {
        this.messageService.add({
          severity: 'success',
          summary: 'Sukces',
          detail: 'Pomyslnie zweryfikowano email, mozesz sie teraz zalogowac',
          life: 5000
        });
      }, 100);
    }
  }

  onSubmit() {
    if (this.loginForm.invalid) return;

    this.isLoading.set(true);
    this.error.set(null);

    const loginData: LoginRequest = {
      email: this.loginForm.value.email,
      password: this.loginForm.value.password
    };

    this.authService.login(loginData).subscribe({
      next: () => {
        this.authService.getCurrentUser().subscribe({
          next: (user) => {
            this.authStateService.setUser(user);
            this.isLoading.set(false);
            const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/todos';
            this.router.navigate([returnUrl]);
          },
          error: () => {
            this.error.set('Nie udało się załadować danych użytkownika');
            this.isLoading.set(false);
          }
        });
      },
      error: (err) => {
        const errorMsg = err.message || 'Nieprawidłowy email lub hasło';
        this.error.set(errorMsg);
        this.isLoading.set(false);

        if (errorMsg.toLowerCase().includes('verified') || errorMsg.toLowerCase().includes('zweryfikuj')) {
          this.messageService.add({
            severity: 'warn',
            summary: 'Email niezweryfikowany',
            detail: 'Sprawdź swoją skrzynkę odbiorczą i zweryfikuj adres email przed zalogowaniem.',
            life: 5000
          });
        }
      }
    });
  }

  get email() { return this.loginForm.get('email'); }
  get password() { return this.loginForm.get('password'); }
}
