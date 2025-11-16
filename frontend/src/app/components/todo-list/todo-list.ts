import { Component, signal, inject, OnInit, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TodoService } from '../../services/todo.service';
import { AuthService } from '../../services/auth.service';
import { AuthStateService } from '../../services/auth-state.service';
import { TodoItemComponent } from '../todo-item/todo-item';
import { TodoFormComponent } from '../todo-form/todo-form';
import { Todo, TodoCreate } from '../../models/todo.model';

@Component({
  selector: 'app-todo-list',
  standalone: true,
  imports: [CommonModule, TodoItemComponent, TodoFormComponent],
  templateUrl: './todo-list.html',
  styleUrl: './todo-list.scss'
})
export class TodoListComponent implements OnInit {
  private todoService = inject(TodoService);
  private authService = inject(AuthService);
  private authStateService = inject(AuthStateService);
  private router = inject(Router);

  // State management with signals
  todos = signal<Todo[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  showForm = signal(false);
  editingTodo = signal<Todo | null>(null);

  // Computed signals
  completedTodos = computed(() => this.todos().filter(todo => todo.completed));
  pendingTodos = computed(() => this.todos().filter(todo => !todo.completed));
  totalTodos = computed(() => this.todos().length);

  // Public getter for current user (needed for template)
  get currentUser() {
    return this.authStateService.currentUser();
  }

  constructor() {
    // Check authentication in component instead of guard
    effect(() => {
      const hasToken = this.authService.isAuthenticated();

      if (!hasToken && typeof window !== 'undefined') {
        this.router.navigate(['/login'], { queryParams: { returnUrl: '/todos' } });
      } else if (hasToken) {
        this.loadTodos();
      }
    });
  }

  ngOnInit() {
  }

  // Load todos from API
  loadTodos() {
    this.loading.set(true);
    this.error.set(null);

    this.todoService.getTodos().subscribe({
      next: (todos) => {
        this.todos.set(todos);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Nie udało się załadować zadań');
        this.loading.set(false);
      }
    });
  }

  // Show form for creating new todo
  showCreateForm() {
    this.editingTodo.set(null);
    this.showForm.set(true);
  }

  // Show form for editing todo
  editTodo(todo: Todo) {
    // Check if current user owns this todo
    const currentUser = this.authStateService.currentUser();
    if (!currentUser || currentUser.id !== todo.user_id) {
      this.error.set('Nie masz uprawnień do edycji tego zadania');
      return;
    }

    this.editingTodo.set(todo);
    this.showForm.set(true);
  }

  // Hide form
  hideForm() {
    this.showForm.set(false);
    this.editingTodo.set(null);
  }

  // Save todo (create or update)
  saveTodo(todoData: TodoCreate) {
    if (this.editingTodo()) {
      // Update existing todo
      this.updateTodo(this.editingTodo()!.id, todoData);
    } else {
      // Create new todo
      this.createTodo(todoData);
    }
  }

  // Create new todo
  private createTodo(todoData: TodoCreate) {
    this.todoService.createTodo(todoData).subscribe({
      next: (newTodo) => {
        this.todos.update(todos => [...todos, newTodo]);
        this.hideForm();
      },
      error: (err) => {
        this.error.set('Nie udało się utworzyć zadania');
      }
    });
  }

  // Update existing todo
  private updateTodo(id: number, todoData: TodoCreate) {
    this.todoService.updateTodo(id, todoData).subscribe({
      next: (updatedTodo) => {
        this.todos.update(todos =>
          todos.map(todo => todo.id === id ? updatedTodo : todo)
        );
        this.hideForm();
      },
      error: (err) => {
        this.error.set('Nie udało się zaktualizować zadania');
      }
    });
  }

  // Toggle todo completion
  toggleTodoCompletion(todo: Todo) {
    this.todoService.updateTodo(todo.id, { completed: !todo.completed }).subscribe({
      next: (updatedTodo) => {
        this.todos.update(todos =>
          todos.map(t => t.id === todo.id ? updatedTodo : t)
        );
      },
      error: (err) => {
        this.error.set('Nie udało się zmienić statusu zadania');
      }
    });
  }

  // Delete todo
  deleteTodo(todo: Todo) {
    // Check if current user owns this todo
    const currentUser = this.authStateService.currentUser();
    if (!currentUser || currentUser.id !== todo.user_id) {
      this.error.set('Nie masz uprawnień do usunięcia tego zadania');
      return;
    }

    if (confirm(`Czy na pewno chcesz usunąć zadanie "${todo.title}"?`)) {
      this.todoService.deleteTodo(todo.id).subscribe({
        next: () => {
          this.todos.update(todos => todos.filter(t => t.id !== todo.id));
        },
        error: (err) => {
          this.error.set('Nie udało się usunąć zadania');
        }
      });
    }
  }

  // Clear error message
  clearError() {
    this.error.set(null);
  }
}
