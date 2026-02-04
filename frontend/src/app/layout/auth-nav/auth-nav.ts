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
import { Tooltip } from 'primeng/tooltip';
import { CommandPaletteService } from '../../core/services/command-palette.service';
import { LanguageService } from '../../core/services/language.service';
import { ScreenSizeService } from '../../core/services/screen-size.service';
import { AuthStore } from '../../core/store/auth.store';
import { AuthService } from '../../features/auth/services/auth.service';
import { ColorToggleComponent } from '../../shared/components/color-toggle/color-toggle.component';
import { LanguageSelectorComponent } from '../../shared/components/language-selector/language-selector.component';
import { SnowToggleComponent } from '../../shared/components/snow-toggle/snow-toggle.component';
import { ThemeToggleComponent } from '../../shared/components/theme-toggle/theme-toggle.component';

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
        ColorToggleComponent,
        SnowToggleComponent,
        LanguageSelectorComponent,
        TranslatePipe,
        Tooltip,
    ],
    templateUrl: './auth-nav.html',
    styleUrl: './auth-nav.scss',
})
export class AuthNavComponent {
    // 1. Injects (readonly private)
    private readonly authStore = inject(AuthStore);
    private readonly authService = inject(AuthService);
    private readonly router = inject(Router);
    private readonly messageService = inject(MessageService);
    private readonly sanitizer = inject(DomSanitizer);
    readonly translate = inject(TranslateService); // exposed for menu templates
    private readonly languageService = inject(LanguageService);
    private readonly screenSize = inject(ScreenSizeService);
    private readonly commandPaletteService = inject(CommandPaletteService);

    // 2. Static constants
    // (None)

    // 3. Decorators input()
    // (None)

    // 4. Decorators output()
    // (None)

    // 5. Decorators viewChild/viewChildren
    // (None)

    // 6. Signals (always readonly)
    readonly currentUser = this.authStore.currentUser;
    readonly isAuthenticated = this.authStore.isAuthenticated;
    readonly isLoading = this.authStore.isLoading;
    readonly userAvatar = this.authStore.userAvatar;
    readonly isPreviewVisible = signal(false);

    // Defer signal access to computed to ensure services are fully initialized
    readonly isCompact = computed(() => this.screenSize.isCompact());
    readonly isSmallScreen = computed(() => this.screenSize.isMobile());

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
                        command: (): void => this.onTriggerFileUpload(),
                    },
                    {
                        label: this.translate.instant('NAV.DELETE_AVATAR'),
                        icon: 'pi pi-trash',
                        visible: hasAvatar,
                        command: (): void => this.onDeleteAvatar(),
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
                        command: (): void => this.onLogout(),
                    },
                ],
            },
        ];
    });

    readonly guestMenuItems = computed<MenuItem[]>(() => {
        // Trigger re-computation on language change
        this.languageService.currentLang();

        return [
            {
                label: this.translate.instant('NAV.LOGIN'),
                icon: 'pi pi-sign-in',
                command: (): void => {
                    this.router.navigate(['/login']);
                },
            },
            {
                label: this.translate.instant('NAV.REGISTER'),
                icon: 'pi pi-user-plus',
                command: (): void => {
                    this.router.navigate(['/register']);
                },
            },
        ];
    });

    // 7. Readonly variables
    // (None)

    // 8. Private variables
    // (None)

    // 9. Public variables
    // (None)

    // 10. Constructor
    constructor() {
        if (typeof window !== 'undefined') {
            window.addEventListener('delete-avatar-command', () => {
                this.onDeleteAvatar();
            });
        }
    }

    // 11. Lifecycle methods
    // (None)

    // 12. Private methods
    // (None)

    // 13. Public methods
    onTriggerFileUpload(): void {
        const fileInput = document.getElementById(
            'avatarInput',
        ) as HTMLInputElement;
        if (fileInput) {
            fileInput.click();
        }
    }

    // 14. Event handlers (use 'on' prefix)
    onLogout(): void {
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

    onDeleteAvatar(): void {
        this.authService.deleteAvatar().subscribe({
            next: () => {
                this.authStore.loadAvatar();
            },
            error: (error) => {
                console.error(error);
            },
        });
    }

    onOpenCommandPalette(): void {
        this.commandPaletteService.open();
    }

    // 15. Getters and Setters
    // (None)
}
