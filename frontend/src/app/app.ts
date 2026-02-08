import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { AuthNavComponent } from './layout/auth-nav/components/auth-nav/auth-nav';
import { CommandPaletteComponent } from './shared/components/command-palette/command-palette';
import { DynamicBackgroundComponent } from './shared/components/dynamic-background/dynamic-background.component';
import { SnowfallComponent } from './shared/components/snowfall/snowfall.component';

@Component({
    selector: 'app-root',
    imports: [
        RouterOutlet,
        AuthNavComponent,
        ToastModule,
        CommandPaletteComponent,
        SnowfallComponent,
        DynamicBackgroundComponent,
    ],
    templateUrl: './app.html',
    styleUrl: './app.scss',
})
export class App {
    protected readonly title = 'Todo App';
}
