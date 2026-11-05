import { HttpContext, HttpErrorResponse } from '@angular/common/http';
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
import {
  GroupSuggestion,
  GroupSuggestionRequest,
  Todo,
  TodoCreate,
  TodosService,
} from '@api';
import { TranslatePipe } from '@ngx-translate/core';
import { DatePicker } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  EMPTY,
  map,
  of,
  Subject,
  switchMap,
  takeUntil,
} from 'rxjs';
import { SILENT_NOTIFICATIONS } from '../../../../core/interceptors/notification.interceptor';
import { LanguageService } from '../../../../core/services/language.service';
import { NetworkStatusService } from '../../../../core/services/network-status.service';
import { isServerUnreachable } from '../../../../core/utils/network-error.util';
import { BadgeComponent } from '../../../../shared/ui/badge/badge.component';
import { FormFieldComponent } from '../../../../shared/ui/form-field/form-field.component';
import { GroupStore } from '../../../groups/store/group.store';
import {
  addDays,
  DUE_TIME_PRESETS,
  fromIsoDate,
  fromTimeString,
  toIsoDate,
  toTimeString,
} from '../../utils/due-date.util';
import { reduceSuggestion, SuggestionState } from './group-suggestion';

/** Keeps the picker's value stable while other fields change. */
const sameInstant = (a: Date | null, b: Date | null): boolean =>
  a?.getTime() === b?.getTime();

interface TodoFormModel {
  title: string;
  description: string;
  groupId: number | null;
  dueDate: string | null;
  /** `HH:MM`. */
  dueTime: string | null;
}

/** The group value lives in the form model; the rest of SuggestionState here. */
type SuggestionMeta = Omit<SuggestionState, 'groupId'>;

/**
 * Set once the endpoint fails while the server is reachable (503 = feature
 * off, or another 4xx/5xx): no more suggestions until the page reloads.
 * Offline and 429 don't set it. Shared by every form instance.
 */
let suggestionsDisabled = false;

const INITIAL_META: SuggestionMeta = {
  source: 'empty',
  chip: null,
  reason: null,
  stopped: false,
};

const NO_SUGGESTION: GroupSuggestion = {
  groupId: null,
  newGroup: null,
  confidence: 'low',
  reason: null,
};

@Component({
  selector: 'app-todo-form',
  imports: [
    FormsModule,
    FormField,
    InputTextModule,
    Select,
    DatePicker,
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
  readonly #networkStatus = inject(NetworkStatusService);
  readonly #language = inject(LanguageService);

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
      dueDate: todo?.dueDate ?? null,
      dueTime: todo?.dueTime?.slice(0, 5) ?? null,
    }),
  });

  readonly todoForm = form(this.todoModel, (s) => {
    required(s.title);
  });

  readonly groups = this.#groupStore.groups;

  /** The pickers hold `Date`s; the model keeps the API's strings. */
  readonly dueDateValue = computed(
    () => {
      const iso = this.todoModel().dueDate;
      return iso ? fromIsoDate(iso) : null;
    },
    { equal: sameInstant },
  );

  readonly dueTimeValue = computed(
    () => {
      const time = this.todoModel().dueTime;
      return time ? fromTimeString(time) : null;
    },
    { equal: sameInstant },
  );

  readonly hourFormat = computed(() =>
    this.#language.currentLang() === 'pl' ? '24' : '12',
  );

  readonly suggestion = linkedSignal<Todo | null, SuggestionMeta>({
    source: this.todo,
    computation: () => INITIAL_META,
  });

  readonly creatingGroup = signal(false);

  readonly timePresets = DUE_TIME_PRESETS;

  /** Bumped by reset(), so the same text typed again asks again. */
  readonly #formRun = signal(0);

  /** Set by onSubmit(): no more suggestions once the todo is on its way. */
  readonly #submitted = signal(false);
  readonly #submit$ = new Subject<void>();

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
        distinctUntilChanged(
          (a, b) =>
            a.run === b.run &&
            a.title === b.title &&
            a.description === b.description,
        ),
        // Every newer input goes through switchMap, so it cancels the
        // request still in flight – even one that doesn't ask again.
        switchMap(({ run, title, description }) => {
          if (!this.#canSuggest()) return EMPTY;
          // An emptied title counts as "no suggestion".
          if (!title) return of({ run, response: NO_SUGGESTION });
          const body: GroupSuggestionRequest = { title, description };
          return this.#todosService
            .suggestGroupForTodoTodosSuggestGroupPost(body, 'body', false, {
              context: new HttpContext().set(SILENT_NOTIFICATIONS, true),
            })
            .pipe(
              // Abort a request still in flight when the user clicks Add.
              takeUntil(this.#submit$),
              map((response) => ({ run, response })),
              catchError((error: unknown) => {
                // Offline or rate-limited: try again on the next input.
                const transient =
                  isServerUnreachable(error) ||
                  (error instanceof HttpErrorResponse && error.status === 429);
                if (!transient) suggestionsDisabled = true;
                return EMPTY;
              }),
            );
        }),
        takeUntilDestroyed(),
      )
      .subscribe(({ run, response }) => {
        // Drop answers for a form that was reset (dialog closed) or switched
        // to edit mode, or that the user took over, while the request ran.
        if (run !== this.#formRun() || !this.#canSuggest()) return;
        const { groupId, ...meta } = reduceSuggestion(
          { groupId: this.todoModel().groupId, ...this.suggestion() },
          response,
        );
        this.todoModel.update((m) => ({ ...m, groupId }));
        this.suggestion.set(meta);
      });
  }

  #canSuggest(): boolean {
    const s = this.suggestion();
    return (
      !suggestionsDisabled &&
      this.#networkStatus.online() &&
      this.todo() === null &&
      !this.#submitted() &&
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
      // null, never undefined: an explicit null clears the value on update.
      dueDate: model.dueDate,
      dueTime: model.dueDate ? model.dueTime : null,
    };

    this.#submitted.set(true);
    this.#submit$.next();
    this.save.emit(todoData);
  }

  /** Called when the dialog closes, so a failed save keeps what was typed. */
  reset(): void {
    this.todoModel.set({
      title: '',
      description: '',
      groupId: null,
      dueDate: null,
      dueTime: null,
    });
    this.todoForm().reset();
    this.suggestion.set(INITIAL_META);
    this.#submitted.set(false);
    this.#formRun.update((n) => n + 1);
  }

  onGroupChange(groupId: number | null): void {
    this.todoModel.update((m) => ({ ...m, groupId }));
    this.suggestion.update((s) => ({ ...s, source: 'user', chip: null }));
  }

  onDueDateChange(date: Date | null): void {
    this.todoModel.update((m) => ({
      ...m,
      dueDate: date ? toIsoDate(date) : null,
      dueTime: date ? m.dueTime : null,
    }));
  }

  onDueTimeChange(date: Date | null): void {
    this.todoModel.update((m) => ({
      ...m,
      dueTime: date ? toTimeString(date) : null,
    }));
  }

  /** Sets the date to today (0) or tomorrow (1); the time stays. */
  onQuickDate(offsetDays: 0 | 1): void {
    this.todoModel.update((m) => ({
      ...m,
      dueDate: addDays(toIsoDate(new Date()), offsetDays),
    }));
  }

  /** Sets the time of the chosen date; the date stays. */
  onQuickTime(time: string): void {
    this.todoModel.update((m) => ({ ...m, dueTime: time }));
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
