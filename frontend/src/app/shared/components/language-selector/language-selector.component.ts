import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { SelectModule } from 'primeng/select';
import { LanguageService } from '../../../core/services/language.service';

@Component({
    selector: 'app-language-selector',
    imports: [FormsModule, TranslateModule, SelectModule],
    template: `
        <div class="flex items-center gap-2">
            <p-select
                size="small"
                optionValue="code"
                optionLabel="name"
                class="w-full md:w-36"
                [options]="languages"
                [ngModelOptions]="{ standalone: true }"
                [(ngModel)]="selectedLanguage"
                (onChange)="onLanguageChange($event)"
            >
                <ng-template pTemplate="selectedItem" let-selectedOption>
                    @if (selectedOption) {
                        <div class="flex items-center gap-2">
                            <span>{{
                                selectedOption.code === 'en' ? '🇺🇸' : '🇵🇱'
                            }}</span>
                            <div>{{ selectedOption.name }}</div>
                        </div>
                    }
                </ng-template>
                <ng-template pTemplate="item" let-country>
                    <div class="flex items-center gap-2">
                        <span>{{ country.code === 'en' ? '🇺🇸' : '🇵🇱' }}</span>
                        <div>{{ country.name }}</div>
                    </div>
                </ng-template>
            </p-select>
        </div>
    `,
    styles: [
        `
            :host {
                display: block;
            }
        `,
    ],
})
export class LanguageSelectorComponent {
    languageService = inject(LanguageService);

    languages = [
        { name: 'English', code: 'en' },
        { name: 'Polski', code: 'pl' },
    ];

    get selectedLanguage(): string {
        return this.languageService.currentLang();
    }

    set selectedLanguage(val: string) {
        // Handled by onChange
    }

    onLanguageChange(event: any): void {
        this.languageService.setLanguage(event.value);
    }
}
