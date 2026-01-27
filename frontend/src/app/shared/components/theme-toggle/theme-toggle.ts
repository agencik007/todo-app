import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../../core/services/theme.service';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="theme-toggle" (click)="$event.stopPropagation(); toggle()" [class.is-dark]="themeService.isDark()">
      <div class="toggle-track">
        <div class="toggle-icon sun">
          <i class="pi pi-sun"></i>
        </div>
        <div class="toggle-icon moon">
          <i class="pi pi-moon"></i>
        </div>
        <div class="toggle-thumb"></div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: inline-block;
      vertical-align: middle;
    }

    .theme-toggle {
      width: 64px;
      height: 32px;
      background: var(--p-surface-200);
      border-radius: 20px;
      position: relative;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex;
      align-items: center;
      padding: 0 4px;
      box-sizing: border-box;
      border: 1px solid var(--p-surface-300);
    }

    .theme-toggle:hover {
      border-color: var(--p-primary-color);
      box-shadow: 0 0 8px rgba(var(--p-primary-rgb), 0.2);
    }

    .is-dark.theme-toggle {
      background: var(--p-surface-800);
      border-color: var(--p-surface-700);
    }

    .toggle-track {
      width: 100%;
      height: 100%;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: relative;
    }

    .toggle-icon {
      font-size: 14px;
      z-index: 1;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;
      color: var(--p-surface-400);
    }

    .is-dark .moon {
      color: var(--p-primary-400);
      text-shadow: 0 0 10px var(--p-primary-400);
    }

    .theme-toggle:not(.is-dark) .sun {
      color: #f59e0b;
      text-shadow: 0 0 10px #f59e0b;
    }

    .toggle-thumb {
      position: absolute;
      width: 24px;
      height: 24px;
      background: #ffffff;
      border-radius: 50%;
      top: 50%;
      transform: translateY(-50%);
      left: 2px;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      z-index: 2;
    }

    .is-dark .toggle-thumb {
      left: calc(100% - 26px);
      background: var(--p-surface-950);
      box-shadow: inset 0 0 2px rgba(255,255,255,0.1);
    }

    .is-dark .sun {
      opacity: 0.2;
      transform: scale(0.8);
    }

    .theme-toggle:not(.is-dark) .moon {
      opacity: 0.2;
      transform: scale(0.8);
    }
  `]
})
export class ThemeToggleComponent {
  protected themeService = inject(ThemeService);

  toggle() {
    const current = this.themeService.mode();
    if (current === 'dark') {
      this.themeService.setMode('light');
    } else {
      this.themeService.setMode('dark');
    }
  }
}
