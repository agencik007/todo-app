import { Component, inject, model, signal } from '@angular/core';
import { FormField, form, required, schema } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { PasswordModule } from 'primeng/password';
import { AuthStore } from '../../../../core/store/auth.store';
import { AuthService } from '../../../../features/auth/services/auth.service';
import { FormFieldComponent } from '../../../../shared/ui/form-field/form-field.component';

interface DeleteAccountData {
  password: string;
}

const deleteAccountSchema = schema<DeleteAccountData>((p) => {
  required(p.password);
});

@Component({
  selector: 'app-delete-account-dialog',
  imports: [
    ButtonModule,
    DialogModule,
    FormField,
    FormFieldComponent,
    PasswordModule,
    TranslatePipe,
  ],
  templateUrl: './delete-account-dialog.html',
  styleUrl: './delete-account-dialog.scss',
})
export class DeleteAccountDialogComponent {
  // 1. Injects (readonly #private)
  readonly #authService = inject(AuthService);
  readonly #authStore = inject(AuthStore);
  readonly #router = inject(Router);

  // 3. Inputs / models
  readonly visible = model(false);

  // 6. Signals (always readonly)
  readonly data = signal<DeleteAccountData>({ password: '' });
  readonly deleteForm = form(this.data, deleteAccountSchema);
  readonly isSubmitting = signal(false);

  // 14. Event handlers (use 'on' prefix)
  onSubmit(event: Event): void {
    event.preventDefault();
    if (this.deleteForm().invalid() || this.isSubmitting()) return;

    this.isSubmitting.set(true);
    this.#authService.deleteAccount(this.data().password).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.visible.set(false);
        this.#authStore.clearUser();
        this.#router.navigate(['/login']);
      },
      // The error toast comes from notificationInterceptor.
      error: () => this.isSubmitting.set(false),
    });
  }

  onHide(): void {
    this.data.set({ password: '' });
    this.deleteForm().reset();
  }
}
