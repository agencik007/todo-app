import { DOCUMENT } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { AppUpdateService } from './core/services/app-update.service';
import { AuthNavComponent } from './layout/auth-nav/components/auth-nav/auth-nav';
import { CommandPaletteComponent } from './shared/components/command-palette/command-palette';
import { DynamicBackgroundComponent } from './shared/components/dynamic-background/dynamic-background.component';
import { LoginAnimationComponent } from './shared/components/login-animation/login-animation';
@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    AuthNavComponent,
    ToastModule,
    ButtonModule,
    TranslatePipe,
    CommandPaletteComponent,
    DynamicBackgroundComponent,
    LoginAnimationComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  readonly #appUpdate = inject(AppUpdateService);

  protected readonly appUpdateToastKey = AppUpdateService.TOAST_KEY;
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

  onReload(): void {
    this.#appUpdate.reload();
  }
}
