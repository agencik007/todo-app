import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { PasswordReset } from '@api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';
import { PasswordModule } from 'primeng/password';
import { AuthService } from '../../services/auth.service';

@Component({
    selector: 'app-reset-password',
    imports: [
        ReactiveFormsModule,
        RouterModule,
        CardModule,
        PasswordModule,
        ButtonModule,
        MessageModule,
    ],
    templateUrl: './reset-password.html',
    styleUrl: './reset-password.scss',
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
        this.resetPasswordForm = this.fb.group(
            {
                password: ['', [Validators.required, Validators.minLength(8)]],
                confirmPassword: ['', [Validators.required]],
            },
            {
                validators: this.passwordMatchValidator,
            },
        );

        // Handle token from path or query params
        this.token.set(
            this.route.snapshot.params['token'] ||
                this.route.snapshot.queryParams['token'],
        );

        if (!this.token()) {
            // Subscribing in case navigation happened before initialization
            this.route.params.subscribe((params) => {
                if (params['token']) {
                    this.token.set(params['token']);
                }
            });
            this.route.queryParams.subscribe((params) => {
                if (params['token']) {
                    this.token.set(params['token']);
                }
            });
        }

        // After a short delay, check if token is still missing
        setTimeout(() => {
            if (!this.token()) {
                this.error.set(
                    'Brak prawidłowego tokenu resetującego hasło. Skorzystaj ponownie z linku w e-mailu.',
                );
            }
        }, 500);
    }

    passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
        const password = control.get('password');
        const confirmPassword = control.get('confirmPassword');

        if (!password || !confirmPassword) {
            return null;
        }

        return password.value === confirmPassword.value
            ? null
            : { passwordMismatch: true };
    }

    onSubmit(): void {
        if (this.resetPasswordForm.invalid || !this.token()) {
            return;
        }

        this.isLoading.set(true);
        this.error.set(null);
        this.success.set(false);

        const resetData: PasswordReset = {
            token: this.token()!,
            new_password: this.resetPasswordForm.value.password,
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
            },
        });
    }

    get password(): AbstractControl | null {
        return this.resetPasswordForm.get('password');
    }

    get confirmPassword(): AbstractControl | null {
        return this.resetPasswordForm.get('confirmPassword');
    }

    get passwordMismatch(): boolean {
        return (
            this.resetPasswordForm.errors?.['passwordMismatch'] &&
            this.confirmPassword?.touched
        );
    }
}
