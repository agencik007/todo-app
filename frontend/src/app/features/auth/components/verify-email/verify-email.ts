import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { MessageService } from 'primeng/api';

// PrimeNG
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageModule } from 'primeng/message';

@Component({
  selector: 'app-verify-email',
  imports: [
    RouterModule,
    CardModule,
    ButtonModule,
    ProgressSpinnerModule,
    MessageModule
  ],
  templateUrl: './verify-email.html',
  styleUrl: './verify-email.scss'
})
export class VerifyEmailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);
  private messageService = inject(MessageService);

  status = signal<'loading' | 'success' | 'error'>('loading');
  message = signal('');
  errorDetail = signal('');

  ngOnInit() {
    const token = this.route.snapshot.paramMap.get('token') || this.route.snapshot.queryParamMap.get('token');
    if (token) {
      this.authService.verifyEmail(token).subscribe({
        next: () => {
          this.status.set('success');
          this.router.navigate(['/login'], { queryParams: { verified: 'success' } });
        },
        error: (err) => {
          this.status.set('error');
          this.message.set('Weryfikacja nie powiodła się');
          if (err.message?.includes('expired')) {
            this.errorDetail.set('Token weryfikacyjny wygasł.');
          } else {
            this.errorDetail.set(err.message || 'Wystąpił błąd podczas weryfikacji.');
          }
          this.messageService.add({
            severity: 'error',
            summary: 'Błąd weryfikacji',
            detail: this.errorDetail(),
            life: 8000
          });
        }
      });
    } else {
      this.status.set('error');
      this.message.set('Brak tokenu weryfikacji');
    }
  }
}
