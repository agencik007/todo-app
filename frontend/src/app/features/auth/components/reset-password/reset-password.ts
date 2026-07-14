import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import {
    FormField,
    form,
    minLength,
    required,
    schema,
} from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { PasswordReset } from '@api';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';
import { PasswordModule } from 'primeng/password';
import { extractApiMessageCode } from '../../../../core/utils/api-error.util';
import { FormFieldComponent } from '../../../../shared/ui/form-field/form-field.component';
import { AuthService } from '../../services/auth.service';

interface ResetPasswordData {
    password: string;
    confirmPassword: string;
}

const resetPasswordSchema = schema<ResetPasswordData>((p) => {
    required(p.password);
    minLength(p.password, 8);
    required(p.confirmPassword);
});

@Component({
    selector: 'app-reset-password',
    imports: [
        FormsModule,
        FormField,
        RouterModule,
        CardModule,
        PasswordModule,
        ButtonModule,
        MessageModule,
        TranslatePipe,
        FormFieldComponent,
    ],
    templateUrl: './reset-password.html',
    styleUrl: './reset-password.scss',
})
export class ResetPasswordComponent {
    private readonly authService = inject(AuthService);
    private readonly router = inject(Router);
    private readonly route = inject(ActivatedRoute);
    private readonly translate = inject(TranslateService);

    protected readonly resetPasswordData = signal<ResetPasswordData>({
        password: '',
        confirmPassword: '',
    });
    protected readonly resetPasswordForm = form(
        this.resetPasswordData,
        resetPasswordSchema,
    );
    protected readonly error = signal<string | null>(null);
    protected readonly success = signal(false);
    protected readonly isLoading = signal(false);
    protected readonly token = signal<string | null>(null);

    protected readonly passwordMismatch = computed(() => {
        const { password, confirmPassword } = this.resetPasswordData();
        return (
            confirmPassword.length > 0 &&
            this.resetPasswordForm.confirmPassword().touched() &&
            password !== confirmPassword
        );
    });

    constructor() {
        this.token.set(
            this.route.snapshot.params['token'] ||
                this.route.snapshot.queryParams['token'],
        );

        if (!this.token()) {
            this.route.params.pipe(takeUntilDestroyed()).subscribe((params) => {
                if (params['token']) this.token.set(params['token']);
            });
            this.route.queryParams
                .pipe(takeUntilDestroyed())
                .subscribe((params) => {
                    if (params['token']) this.token.set(params['token']);
                });
        }

        setTimeout(() => {
            if (!this.token()) {
                this.error.set(
                    this.translate.instant(
                        'AUTH.RESET_PASSWORD.ERRORS.TOKEN_MISSING',
                    ),
                );
            }
        }, 500);
    }

    protected onSubmit(): void {
        if (
            this.resetPasswordForm().invalid() ||
            this.passwordMismatch() ||
            !this.token()
        )
            return;

        this.isLoading.set(true);
        this.error.set(null);
        this.success.set(false);

        const resetData: PasswordReset = {
            token: this.token()!,
            newPassword: this.resetPasswordData().password,
        };

        this.authService.resetPassword(resetData).subscribe({
            next: () => {
                this.success.set(true);
                this.isLoading.set(false);
                setTimeout(() => this.router.navigate(['/login']), 2000);
            },
            error: (err: unknown) => {
                const messageCode = extractApiMessageCode(err);

                if (messageCode) {
                    this.error.set(
                        this.translate.instant(`API_MESSAGES.${messageCode}`),
                    );
                } else {
                    this.error.set(
                        this.translate.instant(
                            'AUTH.RESET_PASSWORD.ERRORS.FAILED',
                        ),
                    );
                }
                this.isLoading.set(false);
            },
        });
    }
}
