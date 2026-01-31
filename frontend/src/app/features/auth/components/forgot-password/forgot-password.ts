import { NgClass } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterModule } from '@angular/router';
import { PasswordResetRequest } from '@api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { AuthService } from '../../services/auth.service';

@Component({
    selector: 'app-forgot-password',
    imports: [
        ReactiveFormsModule,
        RouterModule,
        CardModule,
        InputTextModule,
        ButtonModule,
        MessageModule,
        NgClass,
    ],
    templateUrl: './forgot-password.html',
    styleUrl: './forgot-password.scss',
})
export class ForgotPasswordComponent {
    private fb = inject(FormBuilder);
    private authService = inject(AuthService);

    forgotPasswordForm: FormGroup;
    error = signal<string | null>(null);
    success = signal(false);
    isLoading = signal(false);

    constructor() {
        this.forgotPasswordForm = this.fb.group({
            email: ['', [Validators.required, Validators.email]],
        });
    }

    onSubmit(): void {
        if (this.forgotPasswordForm.invalid) {
            return;
        }

        this.isLoading.set(true);
        this.error.set(null);
        this.success.set(false);

        const request: PasswordResetRequest = {
            email: this.forgotPasswordForm.value.email,
        };

        this.authService.forgotPassword(request).subscribe({
            next: () => {
                this.success.set(true);
                this.isLoading.set(false);
            },
            error: (err) => {
                this.error.set(
                    err.message ||
                        'Nie udało się wysłać emaila resetującego hasło',
                );
                this.isLoading.set(false);
            },
        });
    }

    get email(): AbstractControl | null {
        return this.forgotPasswordForm.get('email');
    }
}
