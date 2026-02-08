import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';

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
    private translate = inject(TranslateService);

    email = signal('');
    resendStatus = signal<'idle' | 'loading' | 'success' | 'error'>('idle');
    resendMessage = signal('');

    constructor() {
        const emailParam = this.route.snapshot.queryParams['email'];
        if (emailParam) {
            this.email.set(emailParam);
        }
    }

    resendEmail(): void {
        // Note: resendVerification requires auth, so user must login first
        // For now, we just show a message to check spam folder
        this.resendStatus.set('success');
        this.resendMessage.set(
            this.translate.instant('AUTH.CHECK_EMAIL.RESEND_SUCCESS'),
        );
    }
}
