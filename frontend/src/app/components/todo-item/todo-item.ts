import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Todo } from '../../models/todo.model';

@Component({
  selector: 'app-todo-item',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './todo-item.html',
  styleUrl: './todo-item.scss'
})
export class TodoItemComponent {
  // Nowa składnia input() zamiast @Input()
  todo = input.required<Todo>();

  // Nowa składnia output() zamiast @Output()
  toggleCompleted = output<void>();
  edit = output<void>();
  delete = output<void>();
}
