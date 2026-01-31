import { Component, input, output, signal, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Todo, TodoCreate } from '../../models/todo.model';

// PrimeNG
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { CheckboxModule } from 'primeng/checkbox';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-todo-form',
  standalone: true,
  imports: [
    FormsModule,
    InputTextModule,
    TextareaModule,
    CheckboxModule,
    ButtonModule
  ],
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
  isPublic = signal(false);
  isSubmitting = signal(false);

  constructor() {
    effect(() => {
      const todo = this.todo();
      if (todo) {
        this.title.set(todo.title);
        this.description.set(todo.description || '');
        this.isPublic.set(todo.is_public || false);
      } else {
        this.title.set('');
        this.description.set('');
        this.isPublic.set(false);
      }
    });
  }

  onSubmit() {
    if (!this.title().trim()) return;

    this.isSubmitting.set(true);

    const todoData: TodoCreate = {
      title: this.title().trim(),
      description: this.description().trim() || undefined,
      is_public: this.isPublic()
    };

    this.save.emit(todoData);

    if (!this.todo()) {
      this.title.set('');
      this.description.set('');
      this.isPublic.set(false);
    }

    this.isSubmitting.set(false);
  }

  onCancel() {
    this.cancel.emit();
  }
}
