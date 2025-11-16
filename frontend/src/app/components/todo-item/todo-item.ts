import { Component, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Todo } from '../../models/todo.model';
import { User } from '../../models/auth.model';

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
  currentUser = input<User | null>();

  // Nowa składnia output() zamiast @Output()
  toggleCompleted = output<void>();
  edit = output<void>();
  delete = output<void>();

  // Computed signal to check if current user can edit/delete this todo
  canEdit = computed(() => {
    const user = this.currentUser();
    const todo = this.todo();
    return user && user.id === todo.user_id;
  });
}
