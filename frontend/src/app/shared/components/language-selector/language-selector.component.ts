import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { LanguageService } from '../../../core/services/language.service';
import { AuthStore } from '../../../core/store/auth.store';

@Component({
    selector: 'app-language-selector',
    imports: [FormsModule, SelectModule],
    templateUrl: './language-selector.component.html',
    styleUrl: './language-selector.component.scss',
})
export class LanguageSelectorComponent {
    // 1. Injects (readonly #private)
    readonly #languageService = inject(LanguageService);
    readonly #authStore = inject(AuthStore);

    // 2. Static constants
    // (None)

    // 3. Decorators input()
    // (None)

    // 4. Decorators output()
    // (None)

    // 5. Decorators viewChild/viewChildren
    // (None)

    // 6. Signals (always readonly)
    readonly currentLang = this.#languageService.currentLang;

    // 7. Readonly variables
    // (None)

    // 8. Private variables (use # prefix)
    // (None)

    // 9. Public variables
    readonly availableLanguages = this.#languageService.availableLanguages;

    // 10. Constructor
    // (None)

    // 11. Lifecycle methods
    // (None)

    // 12. Private methods (use # prefix)
    // (None)

    // 13. Public methods
    // (None)

    // 14. Event handlers (use 'on' prefix)
    onLanguageChange(event: { value: string }): void {
        this.#languageService.setLanguage(event.value);
        this.#authStore.syncLanguage(event.value);
    }

    // 15. Getters and Setters
}
