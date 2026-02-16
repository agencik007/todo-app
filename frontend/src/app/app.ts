import { DOCUMENT } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { ToastModule } from 'primeng/toast';
import { AuthNavComponent } from './layout/auth-nav/components/auth-nav/auth-nav';
import { CommandPaletteComponent } from './shared/components/command-palette/command-palette';
import { DynamicBackgroundComponent } from './shared/components/dynamic-background/dynamic-background.component';
import { LoginAvatarAnimationComponent } from './shared/components/login-avatar-animation/login-avatar-animation';
import { SnowfallComponent } from './shared/components/snowfall/snowfall.component';

@Component({
    selector: 'app-root',
    imports: [
        RouterOutlet,
        AuthNavComponent,
        ToastModule,
        CommandPaletteComponent,
        SnowfallComponent,
        DynamicBackgroundComponent,
        LoginAvatarAnimationComponent,
    ],
    templateUrl: './app.html',
    styleUrl: './app.scss',
})
export class App implements OnInit {
    protected readonly title = 'Todo App';
    private readonly translate = inject(TranslateService);
    private readonly document = inject(DOCUMENT);

    ngOnInit(): void {
        this.translate.onLangChange.subscribe((event) => {
            this.document.documentElement.lang = event.lang;
        });

        // Set initial lang
        const currentLang =
            this.translate.currentLang || this.translate.defaultLang;
        if (currentLang) {
            this.document.documentElement.lang = currentLang;
        }
    }
}
