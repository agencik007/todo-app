import {
    Component,
    effect,
    inject,
    input,
    output,
    signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Todo, TodoCreate } from '@api';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { GroupStore } from '../../../groups/store/group.store';

@Component({
    selector: 'app-todo-form',
    imports: [
        FormsModule,
        InputTextModule,
        TextareaModule,
        CheckboxModule,
        ButtonModule,
        SelectModule,
        TranslatePipe,
    ],
    templateUrl: './todo-form.html',
    styleUrl: './todo-form.scss',
})
export class TodoFormComponent {
    readonly #groupStore = inject(GroupStore);

    // Input for editing existing todo
    todo = input<Todo | null>(null);

    // Outputs
    save = output<TodoCreate>();
    cancelTodo = output<void>();

    // Form state using signals
    title = signal('');
    description = signal('');
    isPublic = signal(false);
    groupId = signal<number | null>(null);
    isSubmitting = signal(false);

    // Expose groups from store
    readonly groups = this.#groupStore.groups;
    readonly loadingGroups = this.#groupStore.loading;

    constructor() {
        effect(() => {
            const todo = this.todo();
            if (todo) {
                this.title.set(todo.title);
                this.description.set(todo.description || '');
                this.isPublic.set(todo.is_public || false);
                this.groupId.set(todo.group_id ?? null);
            } else {
                this.title.set('');
                this.description.set('');
                this.isPublic.set(false);
                this.groupId.set(null);
            }
        });
    }

    // Groups are loaded by parent component (TodoListComponent)

    onSubmit(): void {
        if (!this.title().trim()) return;

        this.isSubmitting.set(true);

        const todoData: TodoCreate = {
            title: this.title().trim(),
            description: this.description().trim() || undefined,
            is_public: this.isPublic(),
            group_id: this.groupId(),
        };

        this.save.emit(todoData);

        if (!this.todo()) {
            this.title.set('');
            this.description.set('');
            this.isPublic.set(false);
            this.groupId.set(null);
        }

        this.isSubmitting.set(false);
    }

    onCancel(): void {
        this.cancelTodo.emit();
    }
}
