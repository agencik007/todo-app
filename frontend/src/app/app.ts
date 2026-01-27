import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthNavComponent } from './layout/auth-nav/auth-nav';
import { AuthStateService } from './core/services/auth-state.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, AuthNavComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  private authStateService = inject(AuthStateService);

  protected readonly title = 'Todo App';

  ngOnInit() {
    this.authStateService.loadUserFromStorage();
  }
}
