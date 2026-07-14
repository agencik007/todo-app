import {
    Component,
    computed,
    inject,
    input,
    linkedSignal,
    output,
    signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FormField, form, required } from '@angular/forms/signals';
import { Todo, TodoCreate } from '@api';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { FormFieldComponent } from '../../../../shared/ui/form-field/form-field.component';
import { GroupStore } from '../../../groups/store/group.store';

interface TodoFormModel {
    title: string;
    description: string;
    groupId: number | null;
}

@Component({
    selector: 'app-todo-form',
    imports: [
        FormsModule,
        FormField,
        InputTextModule,
        ButtonModule,
        Select,
        TranslatePipe,
        FormFieldComponent,
    ],
    templateUrl: './todo-form.html',
    styleUrl: './todo-form.scss',
})
export class TodoFormComponent {
    readonly #groupStore = inject(GroupStore);
    readonly #translateService = inject(TranslateService);

    todo = input<Todo | null>(null);

    save = output<TodoCreate>();
    cancelTodo = output<void>();

    readonly todoModel = linkedSignal<Todo | null, TodoFormModel>({
        source: this.todo,
        computation: (todo) => ({
            title: todo?.title ?? '',
            description: todo?.description ?? '',
            groupId: todo?.groupId ?? null,
        }),
    });

    readonly todoForm = form(this.todoModel, (s) => {
        required(s.title, {
            message: this.#translateService.instant(
                'TODOS.FORM.ERRORS.TITLE_REQUIRED',
            ),
        });
    });

    readonly isSubmitting = signal(false);

    readonly groups = this.#groupStore.groups;
    readonly loadingGroups = this.#groupStore.loading;

    readonly isEditMode = computed(() => !!this.todo());

    onSubmit(): void {
        if (this.todoForm().invalid()) return;

        this.isSubmitting.set(true);

        const model = this.todoModel();
        const todoData: TodoCreate = {
            title: model.title.trim(),
            description: model.description.trim() || undefined,
            groupId: model.groupId,
        };

        this.save.emit(todoData);

        if (!this.todo()) {
            this.todoModel.set({
                title: '',
                description: '',
                groupId: null,
            });
        }

        this.isSubmitting.set(false);
    }

    onCancel(): void {
        this.cancelTodo.emit();
    }

    onGroupChange(groupId: number | null): void {
        this.todoModel.update((m) => ({ ...m, groupId }));
    }
}
