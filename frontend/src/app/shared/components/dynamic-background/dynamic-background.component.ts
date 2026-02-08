import { Component, inject } from '@angular/core';
import { BackgroundService } from '../../../core/services/background.service';

@Component({
    selector: 'app-dynamic-background',
    imports: [],
    templateUrl: './dynamic-background.component.html',
    styleUrl: './dynamic-background.component.scss',
})
export class DynamicBackgroundComponent {
    readonly #backgroundService = inject(BackgroundService);
    readonly isEnabled = this.#backgroundService.isEnabled;
}
