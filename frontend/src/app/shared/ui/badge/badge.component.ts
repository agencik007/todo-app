import {
    booleanAttribute,
    ChangeDetectionStrategy,
    Component,
    computed,
    input,
    output,
} from '@angular/core';

export type BadgeSize = 'sm' | 'md' | 'lg';

/** Nazwy kolorów odpowiadające klasom .group-color-* z _group-colors.scss. */
const BADGE_COLORS = [
    'blue',
    'green',
    'red',
    'yellow',
    'purple',
    'pink',
    'orange',
    'teal',
    'indigo',
    'gray',
] as const;

/**
 * Kolorowa etykieta z kropką (dawny app-group-badge, teraz bez zależności
 * od domeny grup — przyjmuje label/color zamiast obiektu Group).
 */
@Component({
    selector: 'app-badge',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <span
            class="badge size-{{ size() }}"
            [class.clickable]="clickable()"
            [attr.tabindex]="clickable() ? 0 : null"
            [attr.aria-label]="label()"
            (keydown.space)="onClick()"
            (keydown.enter)="onClick()"
            (click)="onClick()"
        >
            <span class="dot {{ colorClass() }}" aria-hidden="true"></span>
            <span class="badge-text">{{ label() }}</span>
        </span>
    `,
    styleUrl: './badge.component.scss',
})
export class BadgeComponent {
    readonly label = input.required<string>();
    /** Nazwa koloru grupowego (blue/green/red/...); nieznane/brak → blue. */
    readonly color = input<string | undefined>('blue');
    readonly size = input<BadgeSize>('md');
    readonly clickable = input(false, { transform: booleanAttribute });

    readonly badgeClick = output<void>();

    protected readonly colorClass = computed(() => {
        const color = this.color() ?? 'blue';
        const known = (BADGE_COLORS as readonly string[]).includes(color);
        return `group-color-${known ? color : 'blue'}`;
    });

    protected onClick(): void {
        if (this.clickable()) {
            this.badgeClick.emit();
        }
    }
}
