import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
    FormField,
    email,
    form,
    required,
    schema,
} from '@angular/forms/signals';
import { RouterModule } from '@angular/router';
import { PasswordResetRequest } from '@api';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { AuthService } from '../../services/auth.service';

interface ForgotPasswordData {
    email: string;
}

const forgotPasswordSchema = schema<ForgotPasswordData>((p) => {
    required(p.email);
    email(p.email);
});

@Component({
    selector: 'app-forgot-password',
    imports: [
        FormsModule,
        FormField,
        RouterModule,
        CardModule,
        InputTextModule,
        ButtonModule,
        MessageModule,
        TranslatePipe,
    ],
    templateUrl: './forgot-password.html',
    styleUrl: './forgot-password.scss',
})
export class ForgotPasswordComponent {
    private readonly authService = inject(AuthService);
    private readonly translate = inject(TranslateService);

    protected readonly forgotPasswordData = signal<ForgotPasswordData>({
        email: '',
    });
    protected readonly forgotPasswordForm = form(
        this.forgotPasswordData,
        forgotPasswordSchema,
    );
    protected readonly error = signal<string | null>(null);
    protected readonly success = signal(false);
    protected readonly isLoading = signal(false);

    protected onSubmit(): void {
        if (this.forgotPasswordForm().invalid()) return;

        this.isLoading.set(true);
        this.error.set(null);
        this.success.set(false);

        const request: PasswordResetRequest = {
            email: this.forgotPasswordData().email,
        };

        this.authService.forgotPassword(request).subscribe({
            next: () => {
                this.success.set(true);
                this.isLoading.set(false);
            },
            error: (err) => {
                const messageCode =
                    err.error?.detail?.messageCode || err.error?.messageCode;

                this.error.set(
                    messageCode
                        ? this.translate.instant(`API_MESSAGES.${messageCode}`)
                        : this.translate.instant(
                              'AUTH.FORGOT_PASSWORD.ERRORS.EMAIL_FAILED',
                          ),
                );
                this.isLoading.set(false);
            },
        });
    }
}
