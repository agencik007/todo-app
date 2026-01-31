import { Injectable, signal, inject, PLATFORM_ID, effect } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type ThemeMode = 'light' | 'dark' | 'system';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private platformId = inject(PLATFORM_ID);
  
  // Current user preference
  readonly mode = signal<ThemeMode>('system');
  
  // Actual calculated state (is it dark now?)
  readonly isDark = signal<boolean>(false);

  private mediaQuery?: MediaQueryList;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const savedMode = localStorage.getItem('theme-mode') as ThemeMode;
      if (savedMode) {
        this.mode.set(savedMode);
      }
      
      this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      
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
  }
}
