import { Component, inject, signal } from '@angular/core';
import {
    AbstractControl,
    FormBuilder,
    FormGroup,
    ReactiveFormsModule,
    ValidationErrors,
    Validators,
} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { UserCreate as RegisterRequest } from '@api';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { PasswordModule } from 'primeng/password';
import { AuthService } from '../../services/auth.service';

@Component({
    selector: 'app-register',
    imports: [
        ReactiveFormsModule,
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
    private fb = inject(FormBuilder);
    private authService = inject(AuthService);
    private router = inject(Router);
    private translate = inject(TranslateService);

    registerForm: FormGroup;
    error = signal<string | null>(null);
    isLoading = signal(false);

    constructor() {
        this.registerForm = this.fb.group(
            {
                email: ['', [Validators.required, Validators.email]],
                password: ['', [Validators.required, Validators.minLength(8)]],
                confirmPassword: ['', [Validators.required]],
            },
            {
                validators: this.passwordMatchValidator,
            },
        );
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
        if (this.registerForm.invalid) {
            return;
        }

        this.isLoading.set(true);
        this.error.set(null);

        const registerData: RegisterRequest = {
            email: this.registerForm.value.email,
            password: this.registerForm.value.password,
        };

        this.authService.register(registerData).subscribe({
            next: () => {
                this.isLoading.set(false);
                // Redirect to check-email page with email param
                this.router.navigate(['/check-email'], {
                    queryParams: { email: registerData.email },
                });
            },
            error: (err) => {
                const errorDetail = err.error?.detail;
                const messageCode =
                    errorDetail?.messageCode || err.error?.messageCode;

                const errorMsg = messageCode
                    ? this.translate.instant(`API_MESSAGES.${messageCode}`)
                    : this.translate.instant('AUTH.REGISTER.ERRORS.FAILED');

                this.error.set(errorMsg);
                this.isLoading.set(false);
            },
        });
    }

    get email(): AbstractControl | null {
        return this.registerForm.get('email');
    }

    get password(): AbstractControl | null {
        return this.registerForm.get('password');
    }

    get confirmPassword(): AbstractControl | null {
        return this.registerForm.get('confirmPassword');
    }

    get passwordMismatch(): boolean {
        return (
            this.registerForm.errors?.['passwordMismatch'] &&
            this.confirmPassword?.touched
        );
    }
}
