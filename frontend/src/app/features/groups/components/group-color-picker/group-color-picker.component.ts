import { Component, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { TooltipModule } from 'primeng/tooltip';
import { getAllGroupColors } from '../../config/group-colors.config';

@Component({
    selector: 'app-group-color-picker',
    standalone: true,
    imports: [TooltipModule, TranslateModule],
    templateUrl: './group-color-picker.html',
    styleUrl: './group-color-picker.scss',
})
export class GroupColorPickerComponent {
    // Inputs
    selectedColor = input.required<string>();

    // Outputs
    colorChange = output<string>();

    // Available colors
    readonly availableColors = getAllGroupColors();

    onColorSelect(color: string): void {
        this.colorChange.emit(color);
    }
}
