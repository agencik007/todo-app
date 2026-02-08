import { Component, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Todo, TodoCreate } from '@api';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';

@Component({
    selector: 'app-todo-form',
    imports: [
        FormsModule,
        InputTextModule,
        TextareaModule,
        CheckboxModule,
        ButtonModule,
        TranslatePipe,
    ],
    templateUrl: './todo-form.html',
    styleUrl: './todo-form.scss',
})
export class TodoFormComponent {
    // Input for editing existing todo
    todo = input<Todo | null>(null);

    // Outputs
    save = output<TodoCreate>();
    cancelTodo = output<void>();

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

    onSubmit(): void {
        if (!this.title().trim()) return;

        this.isSubmitting.set(true);

        const todoData: TodoCreate = {
            title: this.title().trim(),
            description: this.description().trim() || undefined,
            is_public: this.isPublic(),
        };

        this.save.emit(todoData);

        if (!this.todo()) {
            this.title.set('');
            this.description.set('');
            this.isPublic.set(false);
        }

        this.isSubmitting.set(false);
    }

    onCancel(): void {
        this.cancelTodo.emit();
    }
}
