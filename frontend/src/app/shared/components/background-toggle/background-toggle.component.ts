import { Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';
import { BackgroundService } from '../../../core/services/background.service';

@Component({
    selector: 'app-background-toggle',
    imports: [TranslatePipe, ButtonModule, Tooltip],
    templateUrl: './background-toggle.component.html',
    styleUrl: './background-toggle.component.scss',
})
export class BackgroundToggleComponent {
    readonly #backgroundService = inject(BackgroundService);
    readonly isEnabled = this.#backgroundService.isEnabled;

    onToggleBackground(): void {
        this.#backgroundService.toggle();
    }
}
