import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Todo, TodoCreate, TodoUpdate, TodosService } from '@api';
import { Observable, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

@Injectable({
    providedIn: 'root',
})
export class TodoService {
    private todosService = inject(TodosService);

    // Get all todos
    getTodos(): Observable<Todo[]> {
        return this.todosService
            .getTodosTodosGet()
            .pipe(catchError(this.handleError));
    }

    // Get single todo by ID
    getTodo(id: number): Observable<Todo> {
        return this.todosService
            .getTodoTodosTodoIdGet(id)
            .pipe(catchError(this.handleError));
    }

    // Create new todo
    createTodo(todo: TodoCreate): Observable<Todo> {
        return this.todosService
            .createTodoTodosPost(todo)
            .pipe(catchError(this.handleError));
    }

    // Update existing todo
    updateTodo(id: number, todo: TodoUpdate): Observable<Todo> {
        return this.todosService
            .updateTodoTodosTodoIdPut(id, todo)
            .pipe(catchError(this.handleError));
    }

    // Delete todo
    deleteTodo(id: number): Observable<void> {
        return this.todosService.deleteTodoTodosTodoIdDelete(id).pipe(
            catchError(this.handleError),
            switchMap(
                () =>
                    new Observable<void>((subscriber) => {
                        subscriber.next();
                        subscriber.complete();
                    }),
            ),
        );
    }

    // Toggle todo completion status
    toggleTodo(id: number): Observable<Todo> {
        return this.getTodo(id).pipe(
            switchMap((todo) =>
                this.updateTodo(id, { completed: !todo.completed }),
            ),
        );
    }

    // Reorder todo
    reorderTodo(id: number, index: number): Observable<Todo> {
        return this.todosService
            .reorderTodoTodosTodoIdReorderPatch(id, { index })
            .pipe(catchError(this.handleError));
    }

    private handleError(error: HttpErrorResponse): Observable<never> {
        let errorMessage = 'An unknown error occurred!';

        if (error.error instanceof ErrorEvent) {
            // Client-side error
            errorMessage = `Error: ${error.error.message}`;
        } else {
            // Server-side error
            errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
        }

        return throwError(() => new Error(errorMessage));
    }
}
