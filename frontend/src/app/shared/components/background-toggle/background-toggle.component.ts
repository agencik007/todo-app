import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { SelectModule } from 'primeng/select';
import { Tooltip } from 'primeng/tooltip';
import {
    BackgroundService,
    BackgroundType,
} from '../../../core/services/background.service';

@Component({
    selector: 'app-background-toggle',
    imports: [TranslatePipe, SelectModule, Tooltip, FormsModule],
    templateUrl: './background-toggle.component.html',
    styleUrl: './background-toggle.component.scss',
})
export class BackgroundToggleComponent {
    readonly #backgroundService = inject(BackgroundService);
    readonly #translate = inject(TranslateService);

    readonly backgroundType = this.#backgroundService.type;

    readonly backgroundOptions = computed(() => [
        {
            label: this.#translate.instant('SETTINGS.BACKGROUND_OPTIONS.off'),
            value: 'off' as BackgroundType,
            icon: 'pi pi-ban',
        },
        {
            label: this.#translate.instant(
                'SETTINGS.BACKGROUND_OPTIONS.school',
            ),
            value: 'school' as BackgroundType,
            icon: 'pi pi-image',
        },
        {
            label: this.#translate.instant(
                'SETTINGS.BACKGROUND_OPTIONS.modern',
            ),
            value: 'modern' as BackgroundType,
            icon: 'pi pi-sparkles',
        },
    ]);

    onBackgroundChange(event: { value: BackgroundType }): void {
        // Since we want to set a specific type, we need to update the service
        // to support setting a specific type, not just toggling.
        this.#backgroundService.setType(event.value);
    }
}
