import { HttpContext } from '@angular/common/http';
import {
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { form, FormField, required } from '@angular/forms/signals';
import { GroupSuggestionRequest, Todo, TodoCreate, TodosService } from '@api';
import { TranslatePipe } from '@ngx-translate/core';
import { InputTextModule } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  EMPTY,
  filter,
  switchMap,
} from 'rxjs';
import { SILENT_NOTIFICATIONS } from '../../../../core/interceptors/notification.interceptor';
import { BadgeComponent } from '../../../../shared/ui/badge/badge.component';
import { FormFieldComponent } from '../../../../shared/ui/form-field/form-field.component';
import { GroupStore } from '../../../groups/store/group.store';
import {
  INITIAL_SUGGESTION_STATE,
  reduceSuggestion,
  SuggestionState,
} from './group-suggestion';

interface TodoFormModel {
  title: string;
  description: string;
  groupId: number | null;
}

/** The group value lives in the form model; the rest of SuggestionState here. */
type SuggestionMeta = Omit<SuggestionState, 'groupId'>;

/**
 * Set once the endpoint fails (503 = feature off, or any other error): no more
 * suggestions until the page reloads. Shared by every form instance.
 */
let suggestionsDisabled = false;

@Component({
  selector: 'app-todo-form',
  imports: [
    FormsModule,
    FormField,
    InputTextModule,
    Select,
    TranslatePipe,
    BadgeComponent,
    FormFieldComponent,
  ],
  templateUrl: './todo-form.html',
  styleUrl: './todo-form.scss',
})
export class TodoFormComponent {
  readonly #groupStore = inject(GroupStore);
  readonly #todosService = inject(TodosService);

  static readonly SUGGEST_DEBOUNCE_MS = 500;
  static readonly TITLE_MAX = 200;
  static readonly DESCRIPTION_MAX = 1000;

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

  readonly suggestion = linkedSignal<Todo | null, SuggestionMeta>({
    source: this.todo,
    computation: () => this.#initialMeta(),
  });

  readonly creatingGroup = signal(false);

  /** Bumped by reset(), so the same text typed again asks again. */
  readonly #formRun = signal(0);

  /** The existing group a `medium` chip points at (hidden if it's gone). */
  readonly chipGroup = computed(() => {
    const chip = this.suggestion().chip;
    if (chip?.kind !== 'existing') return null;
    return this.groups().find((g) => g.id === chip.groupId) ?? null;
  });

  readonly newGroupChip = computed(() => {
    const chip = this.suggestion().chip;
    return chip?.kind === 'new' ? chip.group : null;
  });

  constructor() {
    const request = computed(() => ({
      run: this.#formRun(),
      title: this.todoModel()
        .title.trim()
        .slice(0, TodoFormComponent.TITLE_MAX),
      description:
        this.todoModel()
          .description.trim()
          .slice(0, TodoFormComponent.DESCRIPTION_MAX) || null,
    }));

    toObservable(request)
      .pipe(
        debounceTime(TodoFormComponent.SUGGEST_DEBOUNCE_MS),
        filter((r) => r.title.length > 0 && this.#canSuggest()),
        distinctUntilChanged(
          (a, b) =>
            a.run === b.run &&
            a.title === b.title &&
            a.description === b.description,
        ),
        switchMap(({ title, description }) => {
          const body: GroupSuggestionRequest = { title, description };
          return this.#todosService
            .suggestGroupForTodoTodosSuggestGroupPost(body, 'body', false, {
              context: new HttpContext().set(SILENT_NOTIFICATIONS, true),
            })
            .pipe(
              catchError(() => {
                suggestionsDisabled = true;
                return EMPTY;
              }),
            );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((response) => {
        // The form may have switched to edit mode while the request ran.
        if (!this.#canSuggest()) return;
        const { groupId, ...meta } = reduceSuggestion(
          { groupId: this.todoModel().groupId, ...this.suggestion() },
          response,
        );
        this.todoModel.update((m) => ({ ...m, groupId }));
        this.suggestion.set(meta);
      });
  }

  #initialMeta(): SuggestionMeta {
    const { source, chip, reason, stopped } = INITIAL_SUGGESTION_STATE;
    return { source, chip, reason, stopped };
  }

  #canSuggest(): boolean {
    const s = this.suggestion();
    return (
      !suggestionsDisabled &&
      this.todo() === null &&
      !s.stopped &&
      s.source !== 'user'
    );
  }

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
    this.suggestion.set(this.#initialMeta());
    this.#formRun.update((n) => n + 1);
  }

  onGroupChange(groupId: number | null): void {
    this.todoModel.update((m) => ({ ...m, groupId }));
    this.suggestion.update((s) => ({ ...s, source: 'user', chip: null }));
  }

  onUndoSuggestion(): void {
    this.todoModel.update((m) => ({ ...m, groupId: null }));
    this.suggestion.update((s) => ({
      ...s,
      source: 'empty',
      chip: null,
      stopped: true,
    }));
  }

  onUseSuggestion(): void {
    const group = this.chipGroup();
    if (!group) return;
    this.onGroupChange(group.id);
  }

  onDismissSuggestion(): void {
    this.suggestion.update((s) => ({ ...s, chip: null, stopped: true }));
  }

  async onCreateSuggestedGroup(): Promise<void> {
    const proposal = this.newGroupChip();
    if (!proposal || this.creatingGroup()) return;

    this.creatingGroup.set(true);
    const group = await this.#groupStore.createGroup({
      name: proposal.name,
      color: proposal.color,
    });
    this.creatingGroup.set(false);

    if (group) {
      this.onGroupChange(group.id);
    }
  }
}
