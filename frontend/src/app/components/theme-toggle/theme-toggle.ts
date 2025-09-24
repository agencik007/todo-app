import { Component, inject } from '@angular/core';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  template: `
    <button
      (click)="toggleTheme()"
      class="theme-toggle-btn"
      [attr.aria-label]="isDark() ? 'Przełącz na tryb jasny' : 'Przełącz na tryb ciemny'">
      @if (isDark()) {
        ☀️
      } @else {
        🌙
      }
    </button>
  `,
  styles: [`
    .theme-toggle-btn {
      position: fixed;
      top: 1rem;
      right: 1rem;
      width: 3rem;
      height: 3rem;
      border-radius: 50%;
      border: none;
      cursor: pointer;
      font-size: 1.25rem;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      transition: all 0.2s ease;
      z-index: 1000;
    }

    .theme-toggle-btn:hover {
      transform: scale(1.1);
      box-shadow: 0 6px 8px rgba(0, 0, 0, 0.15);
    }

    /* Light mode styles */
    :host-context(:not(.dark)) .theme-toggle-btn {
      background: white;
      color: #1f2937;
    }

    /* Dark mode styles */
    :host-context(.dark) .theme-toggle-btn {
      background: #374151;
      color: #f9fafb;
    }
  `]
})
export class ThemeToggleComponent {
  private themeService = inject(ThemeService);

  isDark = this.themeService.isDark;

  toggleTheme() {
    this.themeService.toggleTheme();
  }
}