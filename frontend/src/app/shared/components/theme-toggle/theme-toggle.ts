import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService, ThemeMode } from '../../../core/services/theme.service';
import { TooltipModule } from 'primeng/tooltip';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  imports: [CommonModule, TooltipModule],
  template: `
    <div
      class="theme-toggle"
      (click)="$event.stopPropagation(); nextMode()"
      [class.mode-light]="themeService.mode() === 'light'"
      [class.mode-system]="themeService.mode() === 'system'"
      [class.mode-dark]="themeService.mode() === 'dark'"
    >
      <div class="toggle-track">
        <div class="toggle-thumb"></div>

        <div
          class="toggle-icon sun"
          pTooltip="Light Mode"
          tooltipPosition="top"
          [showDelay]="200"
          (click)="$event.stopPropagation(); setMode('light')"
        >
          <i class="pi pi-sun"></i>
        </div>

        <div
          class="toggle-icon system"
          pTooltip="System Preference"
          tooltipPosition="top"
          [showDelay]="200"
          (click)="$event.stopPropagation(); setMode('system')"
        >
          <i class="pi pi-desktop"></i>
        </div>

        <div
          class="toggle-icon moon"
          pTooltip="Dark Mode"
          tooltipPosition="top"
          [showDelay]="200"
          (click)="$event.stopPropagation(); setMode('dark')"
        >
          <i class="pi pi-moon"></i>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: inline-block;
      vertical-align: middle;
    }

    .theme-toggle {
      width: 92px;
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

    .dark .theme-toggle {
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
      z-index: 2;
      width: 26px;
      height: 26px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;
      color: var(--p-surface-500);
    }

    .toggle-icon:hover {
      color: var(--p-primary-color);
    }

    .toggle-thumb {
      position: absolute;
      width: 26px;
      height: 26px;
      background: var(--p-primary-color);
      border-radius: 50%;
      top: 50%;
      margin-top: -13px;
      left: 0;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      z-index: 1;
    }

    .mode-light .toggle-thumb {
      transform: translateX(0);
    }

    .mode-system .toggle-thumb {
      transform: translateX(29px);
    }

    .mode-dark .toggle-thumb {
      transform: translateX(58px);
    }

    /* Active Icon Colors */
    .mode-light .sun,
    .mode-system .system,
    .mode-dark .moon {
      color: #ffffff !important;
    }

    /* Visual Weight Corrections */
    .pi-moon {
      transform: rotate(-15deg) translateX(1px);
    }
    
    .pi-desktop {
      font-size: 13px;
    }
  `]
})
export class ThemeToggleComponent {
  protected themeService = inject(ThemeService);

  setMode(mode: ThemeMode) {
    this.themeService.setMode(mode);
  }

  nextMode() {
    const current = this.themeService.mode();
    const modes: ThemeMode[] = ['light', 'system', 'dark'];
    const currentIndex = modes.indexOf(current);
    const nextIndex = (currentIndex + 1) % modes.length;
    this.setMode(modes[nextIndex]);
  }
}
