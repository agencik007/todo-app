import { Component, inject, signal, computed } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { AuthStateService } from '../../core/services/auth-state.service';
import { AuthService } from '../../features/auth/services/auth.service';
import { ThemeService, ThemeMode } from '../../core/services/theme.service';

// PrimeNG
import { MessageService } from 'primeng/api';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';
import { MenubarModule } from 'primeng/menubar';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ToastModule } from 'primeng/toast';

@Component({
  selector: 'app-auth-nav',
  imports: [
    RouterModule,
    MenubarModule,
    ButtonModule,
    AvatarModule,
    ProgressSpinnerModule,
    MenuModule,
    ToastModule
  ],
  providers: [MessageService],
  templateUrl: './auth-nav.html',
  styleUrl: './auth-nav.scss'
})
export class AuthNavComponent {
  private authStateService = inject(AuthStateService);
  private authService = inject(AuthService);
  private themeService = inject(ThemeService);
  private router = inject(Router);
  private messageService = inject(MessageService);

  readonly currentUser = this.authStateService.currentUser;
  readonly isAuthenticated = this.authStateService.isAuthenticated;
  readonly isLoading = this.authStateService.isLoading;
  readonly userAvatar = this.authStateService.userAvatar;

  readonly menuItems = computed<MenuItem[]>(() => {
    const currentMode = this.themeService.mode();
    
    return [
      {
        label: 'Użytkownik',
        items: [
          {
            label: 'Zmień awatar',
            icon: 'pi pi-upload',
            command: () => this.triggerFileUpload()
          },
          {
            label: 'Usuń awatar',
            icon: 'pi pi-trash',
            command: () => this.deleteAvatar()
          },
          {
            label: 'Wyloguj',
            icon: 'pi pi-sign-out',
            command: () => this.logout()
          }
        ]
      },
      {
        label: 'Motyw',
        items: [
          {
            label: 'Jasny',
            icon: currentMode === 'light' ? 'pi pi-check' : 'pi pi-sun',
            command: () => this.themeService.setMode('light')
          },
          {
            label: 'Ciemny',
            icon: currentMode === 'dark' ? 'pi pi-check' : 'pi pi-moon',
            command: () => this.themeService.setMode('dark')
          },
          {
            label: 'Systemowy',
            icon: currentMode === 'system' ? 'pi pi-check' : 'pi pi-desktop',
            command: () => this.themeService.setMode('system')
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
    fileInput?.click();
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
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
