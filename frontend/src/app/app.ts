import { Component } from '@angular/core';
import { TodoListComponent } from './components/todo-list/todo-list';
import { ThemeToggleComponent } from './components/theme-toggle/theme-toggle';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [TodoListComponent, ThemeToggleComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = 'Todo App';
}
