import {
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FormField, form, required } from '@angular/forms/signals';
import { Todo, TodoCreate } from '@api';
import { TranslatePipe } from '@ngx-translate/core';
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
})
export class TodoFormComponent {
  readonly #groupStore = inject(GroupStore);

  todo = input<Todo | null>(null);

  save = output<TodoCreate>();

  readonly todoModel = linkedSignal<Todo | null, TodoFormModel>({
    source: this.todo,
    computation: (todo) => ({
      title: todo?.title ?? '',
      description: todo?.description ?? '',
      groupId: todo?.groupId ?? null,
    }),
  });

  readonly todoForm = form(this.todoModel, (s) => {
    required(s.title);
  });

  readonly groups = this.#groupStore.groups;
  readonly loadingGroups = this.#groupStore.loading;

  readonly isEditMode = computed(() => !!this.todo());

  onSubmit(): void {
    if (this.todoForm().invalid()) return;

    const model = this.todoModel();
    const todoData: TodoCreate = {
      title: model.title.trim(),
      description: model.description.trim() || undefined,
      groupId: model.groupId,
    };

    this.save.emit(todoData);
  }

  /** Called when the dialog closes, so a failed save keeps what was typed. */
  reset(): void {
    this.todoModel.set({ title: '', description: '', groupId: null });
    this.todoForm().reset();
  }

  onGroupChange(groupId: number | null): void {
    this.todoModel.update((m) => ({ ...m, groupId }));
  }
}
