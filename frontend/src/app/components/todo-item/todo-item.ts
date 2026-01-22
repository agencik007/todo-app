import { Component, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BadgeComponent } from '../ui/badge/badge.component';
import { CheckboxComponent } from '../ui/checkbox/checkbox.component';
import { Todo } from '../../models/todo.model';
import { User } from '../../models/auth.model';

@Component({
  selector: 'app-todo-item',
  standalone: true,

  templateUrl: './todo-item.html',
  styleUrl: './todo-item.scss',
  imports: [CommonModule, BadgeComponent, CheckboxComponent]
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
