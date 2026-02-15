import { httpResource } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Todo, TodoCreate, TodosService, TodoUpdate } from '@api';
import { Observable } from 'rxjs';
import { API_URL } from '../../../core/tokens/api-url.token';

@Injectable({
    providedIn: 'root',
})
export class TodoService {
    readonly #todosService = inject(TodosService);
    readonly #apiUrl = inject(API_URL);

    // Reactive resource for fetching all todos (GET /todos)
    readonly todosResource = httpResource<Todo[]>(
        () => `${this.#apiUrl}/todos`,
    );

    // Mutations — keep as Observables (httpResource is only for reads)

    createTodo(todo: TodoCreate): Observable<Todo> {
        return this.#todosService.createTodoTodosPost(todo);
    }

    updateTodo(id: number, todo: TodoUpdate): Observable<Todo> {
        return this.#todosService.updateTodoTodosTodoIdPut(id, todo);
    }

    deleteTodo(id: number): Observable<{ [key: string]: any }> {
        return this.#todosService.deleteTodoTodosTodoIdDelete(id);
    }

    reorderTodo(id: number, index: number): Observable<Todo> {
        return this.#todosService.reorderTodoTodosTodoIdReorderPatch(id, {
            index,
        });
    }
}
