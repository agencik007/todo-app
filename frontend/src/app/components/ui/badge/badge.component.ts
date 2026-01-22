import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type BadgeVariant = 'default' | 'outline' | 'secondary' | 'destructive' | 'public' | 'readonly';

@Component({
    selector: 'app-badge',
    standalone: true,
    imports: [CommonModule],
    template: `
    <span class="badge" [class]="variant()">
      <ng-content></ng-content>
    </span>
  `,
    styles: [`
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.25rem 0.5rem;
      font-size: 0.75rem;
      font-weight: 500;
      border-radius: 0.375rem;
      white-space: nowrap;
      transition: all 0.2s ease;
      border: 1px solid transparent;
    }

    /* Variants */
    .public {
      color: #2563eb;
      background-color: #eff6ff;
      border-color: #bfdbfe;
    }

    .readonly {
      color: #6b7280;
      background-color: #f9fafb;
      border-color: #e5e7eb;
    }

    /* Dark Mode Support */
    :host-context(.dark) {
      .public {
        color: #60a5fa;
        background-color: rgba(37, 99, 235, 0.1);
        border-color: rgba(37, 99, 235, 0.2);
      }

      .readonly {
        color: #9ca3af;
        background-color: rgba(107, 114, 128, 0.1);
        border-color: rgba(107, 114, 128, 0.2);
      }
    }
  `]
})
export class BadgeComponent {
    variant = input<BadgeVariant>('default');
}
