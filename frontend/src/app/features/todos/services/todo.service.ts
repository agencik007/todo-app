import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Todo, TodoCreate, TodoUpdate } from '@api';
import { Observable, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

@Injectable({
    providedIn: 'root',
})
export class TodoService {
    private apiUrl = environment.apiUrl;

    constructor(private http: HttpClient) {}

    // Get all todos
    getTodos(): Observable<Todo[]> {
        return this.http
            .get<Todo[]>(`${this.apiUrl}/todos`)
            .pipe(catchError(this.handleError));
    }

    // Get single todo by ID
    getTodo(id: number): Observable<Todo> {
        return this.http
            .get<Todo>(`${this.apiUrl}/todos/${id}`)
            .pipe(catchError(this.handleError));
    }

    // Create new todo
    createTodo(todo: TodoCreate): Observable<Todo> {
        return this.http
            .post<Todo>(`${this.apiUrl}/todos`, todo)
            .pipe(catchError(this.handleError));
    }

    // Update existing todo
    updateTodo(id: number, todo: TodoUpdate): Observable<Todo> {
        return this.http
            .put<Todo>(`${this.apiUrl}/todos/${id}`, todo)
            .pipe(catchError(this.handleError));
    }

    // Delete todo
    deleteTodo(id: number): Observable<void> {
        return this.http
            .delete<void>(`${this.apiUrl}/todos/${id}`)
            .pipe(catchError(this.handleError));
    }

    // Toggle todo completion status
    toggleTodo(id: number): Observable<Todo> {
        return this.getTodo(id).pipe(
            switchMap((todo) =>
                this.updateTodo(id, { completed: !todo.completed }),
            ),
        );
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
