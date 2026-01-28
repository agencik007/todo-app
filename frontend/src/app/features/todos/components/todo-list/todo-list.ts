import { Component, signal, inject, OnInit, computed, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TodoService } from '../../services/todo.service';
import { AuthService } from '../../../auth/services/auth.service';
import { AuthStateService } from '../../../../core/services/auth-state.service';
import { TodoFormComponent } from '../todo-form/todo-form';
import { Todo, TodoCreate } from '../../models/todo.model';
import { delay } from 'rxjs/operators';

// PrimeNG
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { SkeletonModule } from 'primeng/skeleton';
import { DialogModule } from 'primeng/dialog';
import { MessageModule } from 'primeng/message';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';

@Component({
  selector: 'app-todo-list',
  imports: [
    FormsModule,
    TodoFormComponent,
    CardModule,
    ButtonModule,
    CheckboxModule,
    TagModule,
    ProgressSpinnerModule,
    SkeletonModule,
    DialogModule,
    MessageModule,
    ConfirmDialogModule
  ],
  providers: [ConfirmationService],
  templateUrl: './todo-list.html',
  styleUrl: './todo-list.scss'
})
export class TodoListComponent implements OnInit {
  private todoService = inject(TodoService);
  private authStateService = inject(AuthStateService);
  private confirmationService = inject(ConfirmationService);
  private platformId = inject(PLATFORM_ID);

  todos = signal<Todo[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  editingTodo = signal<Todo | null>(null);
  formVisible = false;

  completedTodos = computed(() => this.todos().filter(todo => todo.completed));
  pendingTodos = computed(() => this.todos().filter(todo => !todo.completed));
  totalTodos = computed(() => this.todos().length);

  get currentUser() {
    return this.authStateService.currentUser();
  }

  ngOnInit() {
    // Only load todos in the browser to avoid 401 errors on SSR
    if (isPlatformBrowser(this.platformId)) {
      this.loadTodos();
    }
  }

  loadTodos() {
    this.loading.set(true);
    this.error.set(null);

    this.todoService.getTodos().pipe(delay(500)).subscribe({
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

  showCreateForm() {
    this.editingTodo.set(null);
    this.formVisible = true;
  }

  editTodo(todo: Todo) {
    if (!this.canEditTodo(todo)) {
      this.error.set('Nie masz uprawnień do edycji tego zadania');
      return;
    }
    this.editingTodo.set(todo);
    this.formVisible = true;
  }

  hideForm() {
    this.formVisible = false;
    this.editingTodo.set(null);
  }

  saveTodo(todoData: TodoCreate) {
    if (this.editingTodo()) {
      this.updateTodo(this.editingTodo()!.id, todoData);
    } else {
      this.createTodo(todoData);
    }
  }

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

  deleteTodo(todo: Todo) {
    if (!this.canEditTodo(todo)) {
      this.error.set('Nie masz uprawnień do usunięcia tego zadania');
      return;
    }

    this.confirmationService.confirm({
      message: `Czy na pewno chcesz usunąć zadanie "${todo.title}"?`,
      header: 'Potwierdź usunięcie',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Tak, usuń',
      rejectLabel: 'Anuluj',
      accept: () => {
        this.todoService.deleteTodo(todo.id).subscribe({
          next: () => {
            this.todos.update(todos => todos.filter(t => t.id !== todo.id));
          },
          error: (err) => {
            this.error.set('Nie udało się usunąć zadania');
          }
        });
      }
    });
  }

  canEditTodo(todo: Todo): boolean {
    const user = this.currentUser;
    return !!user && user.id === todo.user_id;
  }

  clearError() {
    this.error.set(null);
  }
}
