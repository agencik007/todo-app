import {
    Component,
    computed,
    inject,
    SecurityContext,
    signal,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { Router, RouterModule } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MenuItem, MessageService } from 'primeng/api';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { MenuModule } from 'primeng/menu';
import { MenubarModule } from 'primeng/menubar';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ToastModule } from 'primeng/toast';
import { LanguageService } from '../../core/services/language.service';
import { ScreenSizeService } from '../../core/services/screen-size.service';
import { AuthStore } from '../../core/store/auth.store';
import { AuthService } from '../../features/auth/services/auth.service';
import { LanguageSelectorComponent } from '../../shared/components/language-selector/language-selector.component';
import { ThemeToggleComponent } from '../../shared/components/theme-toggle/theme-toggle';

@Component({
    selector: 'app-auth-nav',
    imports: [
        RouterModule,
        MenubarModule,
        ButtonModule,
        AvatarModule,
        ProgressSpinnerModule,
        MenuModule,
        ToastModule,
        DialogModule,
        ThemeToggleComponent,
        LanguageSelectorComponent,
        TranslatePipe,
    ],
    templateUrl: './auth-nav.html',
    styleUrl: './auth-nav.scss',
})
export class AuthNavComponent {
    private authStore = inject(AuthStore);
    private authService = inject(AuthService);
    private router = inject(Router);
    private messageService = inject(MessageService);
    private sanitizer = inject(DomSanitizer);
    public translate = inject(TranslateService);
    public languageService = inject(LanguageService);
    public screenSize = inject(ScreenSizeService);

    readonly currentUser = this.authStore.currentUser;
    readonly isAuthenticated = this.authStore.isAuthenticated;
    readonly isLoading = this.authStore.isLoading;
    readonly userAvatar = this.authStore.userAvatar;
    readonly isPreviewVisible = signal(false);

    readonly sanitizedAvatarUrl = computed(() => {
        const url = this.userAvatar();
        if (!url) return undefined;
        return this.sanitizer.sanitize(SecurityContext.URL, url) || undefined;
    });

    readonly menuItems = computed<MenuItem[]>(() => {
        const hasAvatar = !!this.userAvatar();
        // Trigger re-computation on language change
        this.languageService.currentLang();

        return [
            {
                label: this.translate.instant('NAV.PROFILE'),
                items: [
                    {
                        label: this.translate.instant('NAV.CHANGE_AVATAR'),
                        icon: 'pi pi-upload',
                        command: (): void => this.triggerFileUpload(),
                    },
                    {
                        label: this.translate.instant('NAV.DELETE_AVATAR'),
                        icon: 'pi pi-trash',
                        visible: hasAvatar,
                        command: (): void => this.deleteAvatar(),
                    },
                ],
            },
            {
                label: this.translate.instant('NAV.ACCOUNT'),
                items: [
                    {
                        label: this.translate.instant('NAV.LOGOUT'),
                        icon: 'pi pi-sign-out',
                        styleClass: 'logout-item',
                        command: (): void => this.logout(),
                    },
                ],
            },
        ];
    });

    logout(): void {
        this.authService.logout().subscribe({
            next: () => {
                this.authStore.clearUser();
                this.router.navigate(['/login']);
            },
            error: () => {
                this.authStore.clearUser();
                this.router.navigate(['/login']);
            },
        });
    }

    triggerFileUpload(): void {
        const fileInput = document.getElementById(
            'avatarInput',
        ) as HTMLInputElement;
        if (fileInput) {
            fileInput.click();
        }
    }

    onFileSelected(event: Event): void {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (file) {
            this.authService.uploadAvatar(file).subscribe({
                next: () => {
                    this.messageService.add({
                        severity: 'success',
                        summary: this.translate.instant('MESSAGES.SUCCESS'),
                        detail: this.translate.instant(
                            'MESSAGES.AVATAR_UPLOAD_SUCCESS',
                        ),
                    });
                    this.authStore.loadAvatar();
                },
                error: (error) => {
                    console.error(error);
                },
            });
        }
        (event.target as HTMLInputElement).value = '';
    }

    deleteAvatar(): void {
        this.authService.deleteAvatar().subscribe({
            next: () => {
                this.authStore.loadAvatar();
            },
            error: (error) => {
                console.error(error);
            },
        });
    }
}
