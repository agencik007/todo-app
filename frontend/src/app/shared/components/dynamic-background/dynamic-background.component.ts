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

    // We will use standard SVG icons. The `colorClass` will match our group-colors variables
    // to keep the 5 main system colors (blue, green, red, yellow, purple).
    readonly backgroundItems = [
        // Book 1
        {
            path: 'M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25',
            colorClass: 'svg-blue',
            animationClass: 'move-1',
            viewBox: '0 0 24 24',
            stroke: 'currentColor',
            fill: 'none',
        },
        // Pencil 1
        {
            path: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z',
            colorClass: 'svg-green',
            animationClass: 'move-2',
            viewBox: '0 0 24 24',
            stroke: 'currentColor',
            fill: 'none',
        },
        // Todo 1
        {
            path: 'M3 5a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5zm16 0H5v14h14V5zm-2 10H7v2h10v-2zm-6-4H7v2h4v-2zm6 0h-4v2h4v-2z',
            colorClass: 'svg-yellow',
            animationClass: 'move-3',
            viewBox: '0 0 24 24',
            stroke: 'currentColor',
            fill: 'currentColor',
        },
        // Web 1
        {
            path: 'M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418',
            colorClass: 'svg-purple',
            animationClass: 'move-4',
            viewBox: '0 0 24 24',
            stroke: 'currentColor',
            fill: 'none',
        },
        // Book 2
        {
            path: 'M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25',
            colorClass: 'svg-red',
            animationClass: 'move-5',
            viewBox: '0 0 24 24',
            stroke: 'currentColor',
            fill: 'none',
        },
        // Pencil 2
        {
            path: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z',
            colorClass: 'svg-blue',
            animationClass: 'move-6',
            viewBox: '0 0 24 24',
            stroke: 'currentColor',
            fill: 'none',
        },
        // Todo 2
        {
            path: 'M3 5a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5zm16 0H5v14h14V5zm-2 10H7v2h10v-2zm-6-4H7v2h4v-2zm6 0h-4v2h4v-2z',
            colorClass: 'svg-green',
            animationClass: 'move-7',
            viewBox: '0 0 24 24',
            stroke: 'currentColor',
            fill: 'currentColor',
        },
        // Web 2
        {
            path: 'M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418',
            colorClass: 'svg-yellow',
            animationClass: 'move-8',
            viewBox: '0 0 24 24',
            stroke: 'currentColor',
            fill: 'none',
        },
    ];
}
