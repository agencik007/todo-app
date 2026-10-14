import { isPlatformBrowser } from '@angular/common';
import { effect, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private platformId = inject(PLATFORM_ID);

  // Current user preference
  readonly mode = signal<ThemeMode>('system');

  // Actual calculated state (is it dark now?)
  readonly isDark = signal<boolean>(false);

  private mediaQuery?: MediaQueryList;

  // <meta name="theme-color"> tags from index.html (one per color scheme)
  // with their original colors.
  #themeColors: { meta: HTMLMetaElement; color: string; dark: boolean }[] = [];

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const savedMode = localStorage.getItem('theme-mode') as ThemeMode;
      if (savedMode) {
        this.mode.set(savedMode);
      }

      this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      this.#themeColors = Array.from(
        document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'),
        (meta) => ({
          meta,
          color: meta.content,
          dark: meta.media.includes('dark'),
        }),
      );

      // Update actual theme based on mode and system preference
      effect(() => {
        const currentMode = this.mode();
        this.applyTheme(currentMode);
      });

      // Listen for system changes
      this.mediaQuery.addEventListener('change', () => {
        if (this.mode() === 'system') {
          this.applyTheme('system');
        }
      });
    }
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('theme-mode', mode);
    }
  }

  private applyTheme(mode: ThemeMode): void {
    if (!isPlatformBrowser(this.platformId)) return;

    let dark: boolean;
    if (mode === 'system') {
      dark = this.mediaQuery?.matches ?? false;
    } else {
      dark = mode === 'dark';
    }

    this.isDark.set(dark);

    if (dark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    this.#syncThemeColor(mode, dark);
  }

  /**
   * Keeps the browser UI color (e.g. the installed app's title bar) in line
   * with the app's theme. The meta tags follow the system color scheme via
   * their `media`; a theme picked by the user overrides both.
   */
  #syncThemeColor(mode: ThemeMode, dark: boolean): void {
    const chosen = this.#themeColors.find((tag) => tag.dark === dark)?.color;
    for (const { meta, color } of this.#themeColors) {
      meta.content = mode === 'system' || !chosen ? color : chosen;
    }
  }
}
