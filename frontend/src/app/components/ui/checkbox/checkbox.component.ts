import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-checkbox',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div 
      class="checkbox-container" 
      [class.checked]="checked()"
      [class.disabled]="disabled()"
      (click)="toggle()">
      
      @if (checked()) {
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="check-icon">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      }
    </div>
  `,
    styles: [`
    .checkbox-container {
      width: 1.25rem;
      height: 1.25rem;
      border: 2px solid #d1d5db;
      border-radius: 0.25rem;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s ease;
      background-color: white;
    }

    .checkbox-container:hover:not(.disabled) {
      border-color: #9ca3af;
    }

    .checkbox-container.checked {
      background-color: #2563eb;
      border-color: #2563eb;
    }

    .checkbox-container.disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .check-icon {
      width: 0.875rem;
      height: 0.875rem;
      color: white;
    }

    /* Dark Mode Support */
    :host-context(.dark) {
      .checkbox-container {
        background-color: #1f2937;
        border-color: #4b5563;
      }

      .checkbox-container:hover:not(.disabled) {
        border-color: #6b7280;
      }

      .checkbox-container.checked {
        background-color: #3b82f6;
        border-color: #3b82f6;
      }
    }
  `]
})
export class CheckboxComponent {
    checked = input<boolean>(false);
    disabled = input<boolean>(false);
    changed = output<boolean>();

    toggle() {
        if (this.disabled()) return;
        this.changed.emit(!this.checked());
    }
}
