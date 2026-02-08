import {
    Component,
    computed,
    HostListener,
    inject,
    SecurityContext,
    signal,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { Tooltip } from 'primeng/tooltip';
import { filter, startWith } from 'rxjs';
import { ScreenSizeService } from '../../../../core/services/screen-size.service';
import { AuthStore } from '../../../../core/store/auth.store';
import { AuthService } from '../../../../features/auth/services/auth.service';
import { BackgroundToggleComponent } from '../../../../shared/components/background-toggle/background-toggle.component';
import { ColorToggleComponent } from '../../../../shared/components/color-toggle/color-toggle.component';
import { LanguageSelectorComponent } from '../../../../shared/components/language-selector/language-selector.component';
import { SnowToggleComponent } from '../../../../shared/components/snow-toggle/snow-toggle.component';
import { ThemeToggleComponent } from '../../../../shared/components/theme-toggle/theme-toggle.component';

@Component({
    selector: 'app-user-profile',
    imports: [
        AvatarModule,
        ButtonModule,
        DialogModule,
        Tooltip,
        TranslatePipe,
        RouterLink,
        ThemeToggleComponent,
        ColorToggleComponent,
        SnowToggleComponent,
        BackgroundToggleComponent,
        LanguageSelectorComponent,
    ],
    templateUrl: './user-profile.html',
    styleUrl: './user-profile.scss',
})
export class UserProfileComponent {
    // 1. Injects (readonly #private)
    readonly #authStore = inject(AuthStore);
    readonly #authService = inject(AuthService);
    readonly #router = inject(Router);
    readonly #messageService = inject(MessageService);
    readonly #sanitizer = inject(DomSanitizer);
    readonly #translate = inject(TranslateService);
    readonly #screenSize = inject(ScreenSizeService);

    // 6. Signals (always readonly)
    readonly currentUser = this.#authStore.currentUser;
    readonly isAuthenticated = this.#authStore.isAuthenticated;
    readonly isLoading = this.#authStore.isLoading;
    readonly userAvatar = this.#authStore.userAvatar;
    readonly isPreviewVisible = signal(false);
    readonly isMenuOpen = signal(false);
    readonly isCompact = computed(() => this.#screenSize.isCompact());

    readonly #currentUrl = signal(this.#router.url);

    constructor() {
        this.#router.events
            .pipe(
                filter((event) => event instanceof NavigationEnd),
                startWith(null),
            )
            .subscribe(() => {
                this.#currentUrl.set(this.#router.url);
            });
    }

    readonly isAuthPage = computed(() => {
        const url = this.#currentUrl();
        return url.includes('/login') || url.includes('/register');
    });

    readonly sanitizedAvatarUrl = computed(() => {
        const url = this.userAvatar();
        if (!url) return undefined;
        return (
            this.#sanitizer.sanitize(SecurityContext.URL, url as string) ||
            undefined
        );
    });

    @HostListener('document:click', ['$event'])
    onDocumentClick(event: MouseEvent): void {
        const target = event.target as HTMLElement;
        const isClickInside = target.closest('.user-profile-container');
        if (!isClickInside && this.isMenuOpen()) {
            this.isMenuOpen.set(false);
        }
    }

    @HostListener('window:delete-avatar-command')
    onDeleteAvatarCommand(): void {
        this.onDeleteAvatar();
    }

    // 13. Public methods
    onToggleMenu(): void {
        this.isMenuOpen.update((v) => !v);
    }

    onTriggerFileUpload(): void {
        const fileInput = document.getElementById(
            'avatarInput',
        ) as HTMLInputElement;
        if (fileInput) {
            fileInput.click();
        }
        this.isMenuOpen.set(false);
    }

    // 14. Event handlers (use 'on' prefix)
    onLogout(): void {
        this.#authStore.logout();
        this.#router.navigate(['/login']);
        this.isMenuOpen.set(false);
    }

    onFileSelected(event: Event): void {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (file) {
            this.#authService.uploadAvatar(file).subscribe({
                next: () => {
                    this.#messageService.add({
                        severity: 'success',
                        summary: this.#translate.instant('MESSAGES.SUCCESS'),
                        detail: this.#translate.instant(
                            'MESSAGES.AVATAR_UPLOAD_SUCCESS',
                        ),
                    });
                    this.#authStore.loadAvatar();
                },
                error: (error: any) => {
                    console.error(error);
                },
            });
        }
        (event.target as HTMLInputElement).value = '';
    }

    onDeleteAvatar(): void {
        this.#authService.deleteAvatar().subscribe({
            next: () => {
                this.#authStore.loadAvatar();
                this.isMenuOpen.set(false);
            },
            error: (error: any) => {
                console.error(error);
            },
        });
    }
}
