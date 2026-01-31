import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthNavComponent } from './layout/auth-nav/auth-nav';
import { ToastModule } from 'primeng/toast';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, AuthNavComponent, ToastModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = 'Todo App';
}
