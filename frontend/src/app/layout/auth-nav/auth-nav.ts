import { Component, inject, computed, SecurityContext } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { Router, RouterModule } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { AuthStateService } from '../../core/services/auth-state.service';
import { AuthService } from '../../features/auth/services/auth.service';
import { ThemeToggleComponent } from '../../shared/components/theme-toggle/theme-toggle';

// PrimeNG
import { MessageService } from 'primeng/api';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';
import { MenubarModule } from 'primeng/menubar';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ToastModule } from 'primeng/toast';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-auth-nav',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MenubarModule,
    ButtonModule,
    AvatarModule,
    ProgressSpinnerModule,
    MenuModule,
    ToastModule,
    ThemeToggleComponent
  ],
  providers: [MessageService],
  templateUrl: './auth-nav.html',
  styleUrl: './auth-nav.scss'
})
export class AuthNavComponent {
  private authStateService = inject(AuthStateService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private messageService = inject(MessageService);
  private sanitizer = inject(DomSanitizer);

  readonly currentUser = this.authStateService.currentUser;
  readonly isAuthenticated = this.authStateService.isAuthenticated;
  readonly isLoading = this.authStateService.isLoading;
  readonly userAvatar = this.authStateService.userAvatar;

  readonly sanitizedAvatarUrl = computed(() => {
    const url = this.userAvatar();
    if (!url) return undefined;
    return this.sanitizer.sanitize(SecurityContext.URL, url) || undefined;
  });

  readonly menuItems = computed<MenuItem[]>(() => {
    const hasAvatar = !!this.userAvatar();
    
    return [
      {
        label: 'Profil',
        items: [
          {
            label: 'Zmień awatar',
            icon: 'pi pi-upload',
            command: () => this.triggerFileUpload()
          },
          {
            label: 'Usuń awatar',
            icon: 'pi pi-trash',
            visible: hasAvatar,
            command: () => this.deleteAvatar()
          }
        ]
      },
      {
        label: 'Konto',
        items: [
          {
            label: 'Wyloguj',
            icon: 'pi pi-sign-out',
            styleClass: 'logout-item',
            command: () => this.logout()
          }
        ]
      }
    ];
  });

  logout() {
    this.authService.logout();
    this.authStateService.clearUser();
    this.router.navigate(['/login']);
  }

  triggerFileUpload() {
    const fileInput = document.getElementById('avatarInput') as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  }

  onFileSelected(event: any) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.authService.uploadAvatar(file).subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: 'Sukces', detail: 'Awatar został zaktualizowany' });
          this.authStateService.loadAvatar();
        },
        error: (err) => {
          this.messageService.add({ severity: 'error', summary: 'Błąd', detail: 'Nie udało się wgrać awatara' });
        }
      });
    }
    event.target.value = '';
  }

  deleteAvatar() {
    this.authService.deleteAvatar().subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Sukces', detail: 'Awatar został usunięty' });
        this.authStateService.loadAvatar();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Błąd', detail: 'Nie udało się usunąć awatara' });
      }
    });
  }
}
