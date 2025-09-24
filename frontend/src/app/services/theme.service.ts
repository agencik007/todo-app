import { Injectable, signal, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private platformId = inject(PLATFORM_ID);

  // Signal for current theme
  private isDarkMode = signal(false);

  constructor() {
    // Only access localStorage in browser
    if (isPlatformBrowser(this.platformId)) {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'dark') {
        this.isDarkMode.set(true);
        this.applyDarkTheme();
      } else {
        this.isDarkMode.set(false);
        this.applyLightTheme();
      }
    }
  }

  // Get current theme
  get isDark() {
    return this.isDarkMode.asReadonly();
  }

  // Toggle theme
  toggleTheme() {
    const newTheme = !this.isDarkMode();
    this.isDarkMode.set(newTheme);

    if (isPlatformBrowser(this.platformId)) {
      if (newTheme) {
        this.applyDarkTheme();
        localStorage.setItem('theme', 'dark');
      } else {
        this.applyLightTheme();
        localStorage.setItem('theme', 'light');
      }
    }
  }

  // Apply dark theme
  private applyDarkTheme() {
    if (isPlatformBrowser(this.platformId)) {
      document.documentElement.classList.add('dark');
    }
  }

  // Apply light theme
  private applyLightTheme() {
    if (isPlatformBrowser(this.platformId)) {
      document.documentElement.classList.remove('dark');
    }
  }
}