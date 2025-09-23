import { Component, signal, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TodoService } from '../../services/todo.service';
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

  ngOnInit() {
    this.loadTodos();
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
        console.error('Error loading todos:', err);
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
        console.error('Error creating todo:', err);
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
        console.error('Error updating todo:', err);
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
        console.error('Error toggling todo:', err);
      }
    });
  }

  // Delete todo
  deleteTodo(todo: Todo) {
    if (confirm(`Czy na pewno chcesz usunąć zadanie "${todo.title}"?`)) {
      this.todoService.deleteTodo(todo.id).subscribe({
        next: () => {
          this.todos.update(todos => todos.filter(t => t.id !== todo.id));
        },
        error: (err) => {
          this.error.set('Nie udało się usunąć zadania');
          console.error('Error deleting todo:', err);
        }
      });
    }
  }

  // Clear error message
  clearError() {
    this.error.set(null);
  }
}
