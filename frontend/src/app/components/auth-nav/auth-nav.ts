import { Component, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthStateService } from '../../services/auth-state.service';

@Component({
  selector: 'app-auth-nav',
  imports: [CommonModule, RouterModule],
  templateUrl: './auth-nav.html',
  styleUrl: './auth-nav.scss'
})
export class AuthNavComponent {
  private authStateService = inject(AuthStateService);
  private router = inject(Router);

  readonly currentUser = this.authStateService.currentUser;
  readonly isAuthenticated = this.authStateService.isAuthenticated;
  readonly isLoading = this.authStateService.isLoading;

  logout() {
    this.authStateService.clearUser();
    this.router.navigate(['/login']);
  }
}

