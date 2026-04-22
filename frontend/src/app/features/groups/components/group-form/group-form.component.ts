import { Component, input, linkedSignal, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
    FormField,
    form,
    maxLength,
    required,
    schema,
} from '@angular/forms/signals';
import { Group, GroupColor, GroupCreate, GroupUpdate } from '@api';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { GroupColorPickerComponent } from '../group-color-picker/group-color-picker.component';

interface GroupFormModel {
    name: string;
    color: GroupColor;
}

const groupSchema = schema<GroupFormModel>((p) => {
    required(p.name);
    maxLength(p.name, 50);
});

@Component({
    selector: 'app-group-form',
    imports: [
        FormsModule,
        FormField,
        InputTextModule,
        ButtonModule,
        TranslatePipe,
        GroupColorPickerComponent,
    ],
    templateUrl: './group-form.html',
    styleUrl: './group-form.scss',
})
export class GroupFormComponent {
    group = input<Group | null>(null);

    saveGroup = output<GroupCreate | GroupUpdate>();
    formCancel = output<void>();

    readonly groupModel = linkedSignal<Group | null, GroupFormModel>({
        source: this.group,
        computation: (g) => ({
            name: g?.name ?? '',
            color: (g?.color as GroupColor) ?? GroupColor.Blue,
        }),
    });

    readonly groupForm = form(this.groupModel, groupSchema);

    readonly isSubmitting = signal(false);

    onSubmit(): void {
        if (this.groupForm().invalid()) return;

        this.isSubmitting.set(true);

        const model = this.groupModel();
        const data: GroupCreate | GroupUpdate = {
            name: model.name.trim(),
            color: model.color,
        };

        this.saveGroup.emit(data);
        this.isSubmitting.set(false);
    }

    onCancel(): void {
        this.formCancel.emit();
    }

    onColorChange(newColor: string): void {
        this.groupModel.update((m) => ({
            ...m,
            color: newColor as GroupColor,
        }));
    }
}
