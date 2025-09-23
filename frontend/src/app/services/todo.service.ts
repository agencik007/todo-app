import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { Todo, TodoCreate, TodoUpdate } from '../models/todo.model';

@Injectable({
  providedIn: 'root'
})
export class TodoService {
  private apiUrl: string;

  constructor(private http: HttpClient) {
    // Dynamic API URL based on current location
    const hostname = window.location.hostname;
    const port = window.location.port;

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      // Local development
      this.apiUrl = 'http://localhost:8000/todos';
    } else {
      // Production (Oracle Cloud) - use same hostname but backend port
      this.apiUrl = `http://${hostname}:8000/todos`;
    }

    console.log('TodoService API URL:', this.apiUrl);
  }

  // Get all todos
  getTodos(): Observable<Todo[]> {
    return this.http.get<Todo[]>(this.apiUrl).pipe(
      catchError(this.handleError)
    );
  }

  // Get single todo by ID
  getTodo(id: number): Observable<Todo> {
    return this.http.get<Todo>(`${this.apiUrl}/${id}`).pipe(
      catchError(this.handleError)
    );
  }

  // Create new todo
  createTodo(todo: TodoCreate): Observable<Todo> {
    return this.http.post<Todo>(this.apiUrl, todo).pipe(
      catchError(this.handleError)
    );
  }

  // Update existing todo
  updateTodo(id: number, todo: TodoUpdate): Observable<Todo> {
    return this.http.put<Todo>(`${this.apiUrl}/${id}`, todo).pipe(
      catchError(this.handleError)
    );
  }

  // Delete todo
  deleteTodo(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      catchError(this.handleError)
    );
  }

  // Toggle todo completion status
  toggleTodo(id: number): Observable<Todo> {
    return this.getTodo(id).pipe(
      map(todo => ({ completed: !todo.completed } as TodoUpdate)),
      catchError(this.handleError)
    ).pipe(
      map(update => this.updateTodo(id, update)),
      catchError(this.handleError)
    ).pipe(
      switchMap(() => this.getTodo(id)),
      catchError(this.handleError)
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

    console.error(errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}
