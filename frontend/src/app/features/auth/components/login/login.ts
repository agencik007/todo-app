import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
    FormField,
    email,
    form,
    minLength,
    required,
    schema,
} from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { UserCreate as LoginRequest } from '@api';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { PasswordModule } from 'primeng/password';
import { LoginAnimationService } from '../../../../core/services/login-animation.service';
import { AuthStore } from '../../../../core/store/auth.store';
import { extractApiMessageCode } from '../../../../core/utils/api-error.util';
import { AuthService } from '../../services/auth.service';

interface LoginData {
    email: string;
    password: string;
}

const loginSchema = schema<LoginData>((p) => {
    required(p.email);
    email(p.email);
    required(p.password);
    minLength(p.password, 8);
});

@Component({
    selector: 'app-login',
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
    templateUrl: './login.html',
    styleUrl: './login.scss',
})
export class LoginComponent {
    private readonly authService = inject(AuthService);
    private readonly authStore = inject(AuthStore);
    private readonly router = inject(Router);
    private readonly route = inject(ActivatedRoute);
    private readonly messageService = inject(MessageService);
    private readonly translate = inject(TranslateService);
    private readonly loginAnimationService = inject(LoginAnimationService);

    protected readonly loginData = signal<LoginData>({
        email: '',
        password: '',
    });
    protected readonly loginForm = form(this.loginData, loginSchema);
    protected readonly error = signal<string | null>(null);
    protected readonly isLoading = signal(false);

    constructor() {
        const verified = this.route.snapshot.queryParams['verified'];
        if (verified === 'success') {
            setTimeout(() => {
                this.messageService.add({
                    severity: 'success',
                    summary: this.translate.instant('MESSAGES.SUCCESS'),
                    detail: this.translate.instant(
                        'AUTH.LOGIN.SUCCESS.VERIFIED',
                    ),
                    life: 5000,
                });
            }, 100);
        }
    }

    protected onSubmit(): void {
        if (this.loginForm().invalid()) return;

        this.isLoading.set(true);
        this.error.set(null);

        const loginRequest: LoginRequest = this.loginData();

        this.authService.login(loginRequest).subscribe({
            next: () => {
                this.authService.getCurrentUser().subscribe({
                    next: async (user) => {
                        await this.authStore.setUser(user);
                        this.isLoading.set(false);
                        this.loginAnimationService.trigger();
                        const returnUrl =
                            this.route.snapshot.queryParams['returnUrl'] ||
                            '/todos';
                        this.router.navigate([returnUrl]);
                    },
                    error: () => {
                        this.error.set(
                            this.translate.instant(
                                'AUTH.LOGIN.ERRORS.USER_DATA_FAILED',
                            ),
                        );
                        this.isLoading.set(false);
                    },
                });
            },
            error: (err: unknown) => {
                const messageCode = extractApiMessageCode(err);

                this.error.set(
                    messageCode
                        ? this.translate.instant(`API_MESSAGES.${messageCode}`)
                        : this.translate.instant(
                              'AUTH.LOGIN.ERRORS.INVALID_CREDENTIALS',
                          ),
                );
                this.isLoading.set(false);
            },
        });
    }
}
