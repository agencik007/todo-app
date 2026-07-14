import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
    FormField,
    email,
    form,
    minLength,
    required,
    schema,
} from '@angular/forms/signals';
import { Router, RouterModule } from '@angular/router';
import { UserCreate as RegisterRequest } from '@api';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { PasswordModule } from 'primeng/password';
import { extractApiMessageCode } from '../../../../core/utils/api-error.util';
import { AuthService } from '../../services/auth.service';

interface RegisterData {
    email: string;
    password: string;
    confirmPassword: string;
}

const registerSchema = schema<RegisterData>((p) => {
    required(p.email);
    email(p.email);
    required(p.password);
    minLength(p.password, 8);
    required(p.confirmPassword);
});

@Component({
    selector: 'app-register',
    imports: [
        FormsModule,
        FormField,
        RouterModule,
        CardModule,
        InputTextModule,
        PasswordModule,
        ButtonModule,
        MessageModule,
        TranslatePipe,
    ],
    templateUrl: './register.html',
    styleUrl: './register.scss',
})
export class RegisterComponent {
    private readonly authService = inject(AuthService);
    private readonly router = inject(Router);
    private readonly translate = inject(TranslateService);

    protected readonly registerData = signal<RegisterData>({
        email: '',
        password: '',
        confirmPassword: '',
    });
    protected readonly registerForm = form(this.registerData, registerSchema);
    protected readonly error = signal<string | null>(null);
    protected readonly isLoading = signal(false);

    protected readonly passwordMismatch = computed(() => {
        const { password, confirmPassword } = this.registerData();
        return (
            confirmPassword.length > 0 &&
            this.registerForm.confirmPassword().touched() &&
            password !== confirmPassword
        );
    });

    protected onSubmit(): void {
        if (this.registerForm().invalid() || this.passwordMismatch()) return;

        this.isLoading.set(true);
        this.error.set(null);

        const { email, password } = this.registerData();
        const registerRequest: RegisterRequest = { email, password };

        this.authService.register(registerRequest).subscribe({
            next: () => {
                this.isLoading.set(false);
                this.router.navigate(['/check-email'], {
                    queryParams: { email: registerRequest.email },
                });
            },
            error: (err: unknown) => {
                const messageCode = extractApiMessageCode(err);

                if (messageCode) {
                    this.error.set(
                        this.translate.instant(`API_MESSAGES.${messageCode}`),
                    );
                } else {
                    this.error.set(
                        this.translate.instant('AUTH.REGISTER.ERRORS.FAILED'),
                    );
                }
                this.isLoading.set(false);
            },
        });
    }
}
