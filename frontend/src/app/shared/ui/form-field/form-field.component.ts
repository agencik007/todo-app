import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Pole formularza: etykieta z opcjonalną ikoną + projekcja kontrolki
 * i komunikatów błędów. Walidacja i tłumaczenia zostają u wołającego —
 * komponent jest czysto prezentacyjny.
 *
 * <app-form-field icon="pi-envelope" inputId="email" [label]="...">
 *     <input pInputText id="email" ... />
 *     @if (invalid) { <small class="p-error">...</small> }
 * </app-form-field>
 */
@Component({
    selector: 'app-form-field',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <label [for]="inputId()">
            @if (icon()) {
                <i class="pi {{ icon() }}" aria-hidden="true"></i>
            }
            {{ label() }}
        </label>
        <ng-content />
    `,
    styleUrl: './form-field.component.scss',
})
export class FormFieldComponent {
    readonly label = input.required<string>();
    /** Klasa ikony PrimeIcons, np. 'pi-envelope'. */
    readonly icon = input<string>();
    /** Id projektowanej kontrolki — trafia do atrybutu for etykiety. */
    readonly inputId = input<string>();
}
