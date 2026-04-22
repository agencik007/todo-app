import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';
import { AuthService } from '../../services/auth.service';

@Component({
    selector: 'app-check-email',
    imports: [
        RouterModule,
        CardModule,
        ButtonModule,
        MessageModule,
        TranslatePipe,
    ],
    templateUrl: './check-email.html',
    styleUrl: './check-email.scss',
})
export class CheckEmailComponent {
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private translate = inject(TranslateService);
    private authService = inject(AuthService);

    email = signal<string | null>(null);
    resendStatus = signal<'idle' | 'success' | 'error'>('idle');
    isLoading = signal(false);
    resendMessage = signal('');

    constructor() {
        const navigation = this.router.currentNavigation();
        const state = navigation?.extras.state as { email: string };

        if (state?.email) {
            this.email.set(state.email);
        } else {
            // Fallback for direct access or refresh if email not in state
            const emailParam = this.route.snapshot.queryParams['email'];
            if (emailParam) {
                this.email.set(emailParam);
            }
        }
    }

    resendEmail(): void {
        const email = this.email();
        if (!email) return;

        this.isLoading.set(true);
        this.resendStatus.set('idle');
        this.resendMessage.set(''); // Clear previous message

        this.authService.resendVerification().subscribe({
            next: () => {
                this.resendStatus.set('success');
                this.resendMessage.set(
                    this.translate.instant('AUTH.CHECK_EMAIL.RESEND_SUCCESS'),
                );
                this.isLoading.set(false);
            },
            error: () => {
                this.resendStatus.set('error');
                this.resendMessage.set(
                    this.translate.instant('AUTH.CHECK_EMAIL.RESEND_ERROR'), // Assuming an error message key
                );
                this.isLoading.set(false);
            },
        });
    }
}
