import {
    ChangeDetectionStrategy,
    Component,
    computed,
    input,
} from '@angular/core';

export type EmptyStateTone = 'neutral' | 'primary' | 'danger';
export type EmptyStateSize = 'md' | 'lg';

/**
 * Pusty stan / stan wynikowy: ikona (lub emoji) + nagłówek + opis
 * + projekcja akcji. Rozmiar lg dla stron wynikowych (np. weryfikacja
 * e-maila), tone koloruje ikonę.
 */
@Component({
    selector: 'app-empty-state',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        '[class]': 'hostClasses()',
    },
    template: `
        @if (emoji()) {
            <span class="empty-visual empty-emoji" aria-hidden="true">{{
                emoji()
            }}</span>
        } @else if (icon()) {
            <i
                class="pi empty-visual empty-icon {{ icon() }}"
                aria-hidden="true"
            ></i>
        }
        <h3>{{ heading() }}</h3>
        @if (description()) {
            <p>{{ description() }}</p>
        }
        <ng-content />
    `,
    styleUrl: './empty-state.component.scss',
})
export class EmptyStateComponent {
    /** Klasa ikony PrimeIcons, np. 'pi-filter-slash'. */
    readonly icon = input<string>();
    /** Alternatywa dla ikony, np. '📝'. */
    readonly emoji = input<string>();
    readonly heading = input.required<string>();
    readonly description = input<string>();
    readonly tone = input<EmptyStateTone>('neutral');
    readonly size = input<EmptyStateSize>('md');

    protected readonly hostClasses = computed(
        () => `tone-${this.tone()} size-${this.size()}`,
    );
}
