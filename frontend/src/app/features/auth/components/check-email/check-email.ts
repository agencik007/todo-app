import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';

@Component({
  selector: 'app-check-email',
  imports: [
    RouterModule,
    CardModule,
    ButtonModule,
    MessageModule
  ],
  templateUrl: './check-email.html',
  styleUrl: './check-email.scss'
})
export class CheckEmailComponent {
  private route = inject(ActivatedRoute);

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
    this.resendMessage.set('Jeśli nie widzisz emaila, sprawdź folder spam.');
  }
}
