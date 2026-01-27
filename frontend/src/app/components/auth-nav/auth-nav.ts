import { Component, inject, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { AuthStateService } from '../../services/auth-state.service';
import { AuthService } from '../../services/auth.service';

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
  private router = inject(Router);
  private messageService = inject(MessageService);

  readonly currentUser = this.authStateService.currentUser;
  readonly isAuthenticated = this.authStateService.isAuthenticated;
  readonly isLoading = this.authStateService.isLoading;
  readonly userAvatar = this.authStateService.userAvatar;

  readonly menuItems = signal<MenuItem[]>([]);

  constructor() {
    console.log('AuthNavComponent constructor');
    this.initializeMenu();
  }

  private initializeMenu() {
    console.log('Initializing menu items...');
    this.menuItems.set([
      {
        label: 'Użytkownik',
        items: [
          {
            label: 'Zmień awatar',
            icon: 'pi pi-upload',
            command: () => {
              console.log('Triggering file upload');
              this.triggerFileUpload();
            }
          },
          {
            label: 'Usuń awatar',
            icon: 'pi pi-trash',
            command: () => {
              console.log('Triggering delete avatar');
              this.deleteAvatar();
            }
          },
          {
            label: 'Wyloguj',
            icon: 'pi pi-sign-out',
            command: () => {
              console.log('LOGOUT COMMAND CLICKED');
              this.logout();
            }
          }
        ]
      }
    ]);
    console.log('Menu items initialized:', this.menuItems);
  }

  logout() {
    console.log('Performing logout...');
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
