import { booleanAttribute, computed, Directive, input } from '@angular/core';

export type IconButtonVariant = 'ghost' | 'primary' | 'danger';
export type IconButtonSize = 'sm' | 'md' | 'lg' | 'xl';

/**
 * Kwadratowy przycisk-ikona design systemu.
 *
 * Dyrektywa na natywnym <button>, więc pTooltip, aria-* i type działają
 * bez zmian. Style: global-styling/_ui.scss (klasy .app-icon-btn--*).
 *
 * Rozmiary: sm 24px / md 28px / lg 32px / xl 40px.
 */
@Directive({
    selector: 'button[appIconButton]',
    host: {
        '[class]': 'hostClasses()',
    },
})
export class IconButtonDirective {
    readonly variant = input<IconButtonVariant>('ghost');
    readonly size = input<IconButtonSize>('md');

    /**
     * Przycisk ukryty (opacity 0) do własnego hovera/focusa; kontener
     * odsłania go regułą `:hover .app-icon-btn--reveal { opacity: 1 }`.
     * Na mobile (bez hovera) zawsze widoczny.
     */
    readonly reveal = input(false, { transform: booleanAttribute });

    protected readonly hostClasses = computed(() =>
        [
            'app-icon-btn',
            `app-icon-btn--${this.variant()}`,
            `app-icon-btn--${this.size()}`,
            ...(this.reveal() ? ['app-icon-btn--reveal'] : []),
        ].join(' '),
    );
}
