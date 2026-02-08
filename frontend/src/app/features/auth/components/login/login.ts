import { NgClass } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import {
    AbstractControl,
    FormBuilder,
    FormGroup,
    ReactiveFormsModule,
    Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { UserCreate as LoginRequest } from '@api';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { PasswordModule } from 'primeng/password';
import { AuthStore } from '../../../../core/store/auth.store';
import { AuthService } from '../../services/auth.service';

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
        NgClass,
        TranslatePipe,
    ],
    templateUrl: './login.html',
    styleUrl: './login.scss',
})
export class LoginComponent {
    private fb = inject(FormBuilder);
    private authService = inject(AuthService);
    private authStore = inject(AuthStore);
    private router = inject(Router);
    private route = inject(ActivatedRoute);
    private messageService = inject(MessageService);
    private translate = inject(TranslateService);

    loginForm: FormGroup;
    error = signal<string | null>(null);
    isLoading = signal(false);

    constructor() {
        this.loginForm = this.fb.group({
            email: ['', [Validators.required, Validators.email]],
            password: ['', [Validators.required, Validators.minLength(8)]],
        });

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

    onSubmit(): void {
        if (this.loginForm.invalid) return;

        this.isLoading.set(true);
        this.error.set(null);

        const loginData: LoginRequest = {
            email: this.loginForm.value.email,
            password: this.loginForm.value.password,
        };

        this.authService.login(loginData).subscribe({
            next: () => {
                this.authService.getCurrentUser().subscribe({
                    next: (user) => {
                        this.authStore.setUser(user);
                        this.isLoading.set(false);
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
            error: (err) => {
                const errorDetail = err.error?.detail;
                const messageCode =
                    errorDetail?.messageCode || err.error?.messageCode;

                const errorMsg = messageCode
                    ? this.translate.instant(`API_MESSAGES.${messageCode}`)
                    : this.translate.instant(
                          'AUTH.LOGIN.ERRORS.INVALID_CREDENTIALS',
                      );

                this.error.set(errorMsg);
                this.isLoading.set(false);

                if (
                    errorMsg.toLowerCase().includes('verified') ||
                    errorMsg.toLowerCase().includes('zweryfikuj')
                ) {
                    this.messageService.add({
                        severity: 'warn',
                        summary: this.translate.instant(
                            'AUTH.LOGIN.ERRORS.NOT_VERIFIED_TITLE',
                        ),
                        detail: this.translate.instant(
                            'AUTH.LOGIN.ERRORS.NOT_VERIFIED_DETAIL',
                        ),
                        life: 5000,
                    });
                }
            },
        });
    }

    get email(): AbstractControl | null {
        return this.loginForm.get('email');
    }

    get password(): AbstractControl | null {
        return this.loginForm.get('password');
    }
}
