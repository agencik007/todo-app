import { Component, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Group, GroupColor, GroupCreate, GroupUpdate } from '@api';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { GroupColorPickerComponent } from '../group-color-picker/group-color-picker.component';

@Component({
    selector: 'app-group-form',
    standalone: true,
    imports: [
        FormsModule,
        InputTextModule,
        ButtonModule,
        TranslatePipe,
        GroupColorPickerComponent,
    ],
    templateUrl: './group-form.html',
    styleUrl: './group-form.scss',
})
export class GroupFormComponent {
    // Input for editing existing group
    group = input<Group | null>(null);

    // Outputs
    saveGroup = output<GroupCreate | GroupUpdate>();
    formCancel = output<void>();

    // Form state
    name = signal('');
    color = signal<GroupColor>(GroupColor.Blue);
    isSubmitting = signal(false);

    constructor() {
        effect(() => {
            const g = this.group();
            if (g) {
                this.name.set(g.name);
                this.color.set(g.color as GroupColor);
            } else {
                this.name.set('');
                this.color.set(GroupColor.Blue);
            }
        });
    }

    onSubmit(): void {
        if (!this.name().trim()) return;

        this.isSubmitting.set(true);

        const data = {
            name: this.name().trim(),
            color: this.color(),
        };

        this.saveGroup.emit(data);
        this.isSubmitting.set(false);
    }

    onCancel(): void {
        this.formCancel.emit();
    }

    onColorChange(newColor: string): void {
        this.color.set(newColor as any);
    }
}
