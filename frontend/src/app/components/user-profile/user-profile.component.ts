import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { AuthStateService } from '../../services/auth-state.service';
import { Router } from '@angular/router';

@Component({
    selector: 'app-user-profile',
    standalone: true,
    imports: [
        CommonModule,
        MatMenuModule,
        MatButtonModule,
        MatIconModule,
        MatDividerModule
    ],
    templateUrl: './user-profile.component.html',
    styleUrl: './user-profile.component.scss'
})
export class UserProfileComponent {
    private authService = inject(AuthService);
    private authStateService = inject(AuthStateService);
    private themeService = inject(ThemeService);
    private router = inject(Router);

    currentUser = this.authStateService.currentUser;
    userAvatar = this.authStateService.userAvatar;
    isDarkMode = this.themeService.isDarkMode;

    toggleTheme(event: Event) {
        event.stopPropagation();
        this.themeService.toggleTheme();
    }

    logout() {
        this.authStateService.clearUser();
        this.router.navigate(['/login']);
    }

    onFileSelected(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files.length > 0) {
            const file = input.files[0];
            this.authService.uploadAvatar(file).subscribe({
                next: (response) => {
                    console.log('Avatar uploaded successfully', response);
                    this.authStateService.loadAvatar();
                },
                error: (err) => {
                    console.error('Avatar upload failed', err);
                }
            });
        }
    }

    deleteAvatar() {
        if (confirm('Czy na pewno chcesz usunąć avatar?')) {
            this.authService.deleteAvatar().subscribe({
                next: () => {
                    console.log('Avatar deleted');
                    this.authStateService.loadAvatar();
                },
                error: (err) => console.error('Error deleting avatar', err)
            });
        }
    }
}