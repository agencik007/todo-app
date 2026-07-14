import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { AuthService } from '../../services/auth.service';

@Component({
    selector: 'app-verify-email',
    imports: [
        RouterModule,
        CardModule,
        ButtonModule,
        ProgressSpinnerModule,
        MessageModule,
        TranslatePipe,
        EmptyStateComponent,
    ],
    templateUrl: './verify-email.html',
    styleUrl: './verify-email.scss',
})
export class VerifyEmailComponent implements OnInit {
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private authService = inject(AuthService);
    private messageService = inject(MessageService);
    private translate = inject(TranslateService);

    status = signal<'loading' | 'success' | 'error'>('loading');
    message = signal('');
    errorDetail = signal('');

    ngOnInit(): void {
        const token =
            this.route.snapshot.paramMap.get('token') ||
            this.route.snapshot.queryParamMap.get('token');
        if (token) {
            this.authService.verifyEmail(token).subscribe({
                next: () => {
                    this.status.set('success');
                    this.router.navigate(['/login'], {
                        queryParams: { verified: 'success' },
                    });
                },
                error: (err) => {
                    this.status.set('error');
                    this.message.set(
                        this.translate.instant(
                            'AUTH.VERIFY_EMAIL.ERRORS.FAILED',
                        ),
                    );
                    if (err.message?.includes('expired')) {
                        this.errorDetail.set(
                            this.translate.instant(
                                'AUTH.VERIFY_EMAIL.ERRORS.EXPIRED',
                            ),
                        );
                    } else {
                        this.errorDetail.set(
                            err.message ||
                                this.translate.instant(
                                    'AUTH.VERIFY_EMAIL.ERRORS.GENERAL',
                                ),
                        );
                    }
                    this.messageService.add({
                        severity: 'error',
                        summary: this.translate.instant(
                            'AUTH.VERIFY_EMAIL.ERRORS.SUMMARY',
                        ),
                        detail: this.errorDetail(),
                        life: 8000,
                    });
                },
            });
        } else {
            this.status.set('error');
            this.message.set(
                this.translate.instant('AUTH.VERIFY_EMAIL.ERRORS.NO_TOKEN'),
            );
        }
    }
}
