import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { PasswordReset } from '../../models/auth.model';

// PrimeNG
import { CardModule } from 'primeng/card';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';

@Component({
  selector: 'app-reset-password',
  imports: [
    ReactiveFormsModule,
    RouterModule,
    CardModule,
    PasswordModule,
    ButtonModule,
    MessageModule
  ],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.scss'
})
export class ResetPasswordComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  resetPasswordForm: FormGroup;
  error = signal<string | null>(null);
  success = signal(false);
  isLoading = signal(false);
  token = signal<string | null>(null);

  constructor() {
    this.resetPasswordForm = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]]
    }, {
      validators: this.passwordMatchValidator
    });

    this.route.params.subscribe(params => {
      this.token.set(params['token'] || null);
      if (!this.token()) {
        this.error.set('Brak tokenu resetującego hasło');
      }
    });
  }

  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password');
    const confirmPassword = control.get('confirmPassword');

    if (!password || !confirmPassword) {
      return null;
    }

    return password.value === confirmPassword.value ? null : { passwordMismatch: true };
  }

  onSubmit() {
    if (this.resetPasswordForm.invalid || !this.token()) {
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);
    this.success.set(false);

    const resetData: PasswordReset = {
      token: this.token()!,
      new_password: this.resetPasswordForm.value.password
    };

    this.authService.resetPassword(resetData).subscribe({
      next: () => {
        this.success.set(true);
        this.isLoading.set(false);
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 2000);
      },
      error: (err) => {
        this.error.set(err.message || 'Nie udało się zresetować hasła');
        this.isLoading.set(false);
      }
    });
  }

  get password() {
    return this.resetPasswordForm.get('password');
  }

  get confirmPassword() {
    return this.resetPasswordForm.get('confirmPassword');
  }

  get passwordMismatch() {
    return this.resetPasswordForm.errors?.['passwordMismatch'] &&
      this.confirmPassword?.touched;
  }
}
