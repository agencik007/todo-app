import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Todo, TodoCreate } from '../../models/todo.model';

@Component({
  selector: 'app-todo-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './todo-form.html',
  styleUrl: './todo-form.scss'
})
export class TodoFormComponent {
  // Input for editing existing todo
  todo = input<Todo | null>(null);

  // Outputs
  save = output<TodoCreate>();
  cancel = output<void>();

  // Form state using signals
  title = signal('');
  description = signal('');
  isSubmitting = signal(false);

  ngOnInit() {
    // If editing existing todo, populate form
    if (this.todo()) {
      this.title.set(this.todo()!.title);
      this.description.set(this.todo()!.description || '');
    }
  }

  onSubmit() {
    if (!this.title().trim()) return;

    this.isSubmitting.set(true);

    const todoData: TodoCreate = {
      title: this.title().trim(),
      description: this.description().trim() || undefined
    };

    this.save.emit(todoData);

    // Reset form if creating new todo
    if (!this.todo()) {
      this.title.set('');
      this.description.set('');
    }

    this.isSubmitting.set(false);
  }

  onCancel() {
    this.cancel.emit();
  }
}
