import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { GroupCatalogItem, UserResponse } from '@api';
import { GroupsService } from '@api/api/groups.service';
import { UsersService } from '@api/api/users.service';
import { TranslateModule } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { AuthStore } from '../../../../core/store/auth.store';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { AuthService } from '../../../auth/services/auth.service';
import { getGroupColorConfig } from '../../../groups/config/group-colors.config';
import { GroupStore } from '../../../groups/store/group.store';

/**
 * First sign-in: the user picks starter groups from the catalogue (or skips).
 * Either way onboarding is completed and the user goes to the todo list.
 */
@Component({
  selector: 'app-welcome',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslateModule,
    ButtonModule,
    ProgressSpinnerModule,
    EmptyStateComponent,
  ],
  templateUrl: './welcome.html',
  styleUrl: './welcome.scss',
})
export class WelcomeComponent implements OnInit {
  readonly #groupsService = inject(GroupsService);
  readonly #usersService = inject(UsersService);
  readonly #authService = inject(AuthService);
  readonly #authStore = inject(AuthStore);
  readonly #groupStore = inject(GroupStore);
  readonly #router = inject(Router);

  readonly catalog = signal<GroupCatalogItem[]>([]);
  readonly selected = signal<Set<string>>(new Set());
  readonly submitting = signal(false);
  readonly status = signal<'loading' | 'ready' | 'error'>('loading');
  readonly selectedCount = computed(() => this.selected().size);
  readonly canWrite = this.#authStore.canWrite;

  ngOnInit(): void {
    this.#groupsService.getGroupCatalogGroupsCatalogGet().subscribe({
      next: (items) => {
        this.catalog.set(items);
        this.selected.set(
          new Set(
            items.filter((item) => item.preselected).map((item) => item.key),
          ),
        );
        this.status.set('ready');
      },
      error: () => this.status.set('error'),
    });
  }

  #complete(groupKeys: string[]): void {
    if (this.submitting()) {
      return;
    }
    this.submitting.set(true);

    this.#usersService
      .completeOnboardingUsersMeOnboardingPost({ groupKeys })
      .subscribe({
        next: (user) => void this.#finish(user),
        error: (err: unknown) => {
          // Already completed (e.g. in another tab): refresh the user and move on.
          if (err instanceof HttpErrorResponse && err.status === 409) {
            this.#authService.getCurrentUser().subscribe({
              next: (user) => void this.#finish(user),
              error: () => this.submitting.set(false),
            });
            return;
          }
          this.submitting.set(false);
        },
      });
  }

  async #finish(user: UserResponse): Promise<void> {
    await this.#authStore.setUser(user);
    this.#groupStore.loadGroups();
    await this.#router.navigateByUrl('/todos');
  }

  colorClass(item: GroupCatalogItem): string {
    return getGroupColorConfig(item.color).cssClass;
  }

  toggle(key: string): void {
    this.selected.update((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  submit(): void {
    this.#complete([...this.selected()]);
  }

  skip(): void {
    this.#complete([]);
  }
}
