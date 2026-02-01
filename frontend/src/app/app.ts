import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { AuthNavComponent } from './layout/auth-nav/auth-nav';

import { CommandPaletteComponent } from './shared/components/command-palette/command-palette';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [
        RouterOutlet,
        AuthNavComponent,
        ToastModule,
        CommandPaletteComponent,
    ],
    templateUrl: './app.html',
    styleUrl: './app.scss',
})
export class App {
    protected readonly title = 'Todo App';
}
