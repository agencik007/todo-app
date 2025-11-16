import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeToggleComponent } from './components/theme-toggle/theme-toggle';
import { AuthNavComponent } from './components/auth-nav/auth-nav';
import { AuthStateService } from './services/auth-state.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ThemeToggleComponent, AuthNavComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  private authStateService = inject(AuthStateService);

  protected readonly title = 'Todo App';

  ngOnInit() {
    // Load user from storage after app initialization (avoids circular dependency)
    this.authStateService.loadUserFromStorage();
  }
}
