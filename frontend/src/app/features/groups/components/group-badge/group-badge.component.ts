import { Component, computed, input, output } from '@angular/core';
import { Group } from '@api';
import { getGroupColorConfig } from '../../config/group-colors.config';

@Component({
    selector: 'app-group-badge',
    imports: [],
    templateUrl: './group-badge.html',
    styleUrl: './group-badge.scss',
})
export class GroupBadgeComponent {
    // Inputs
    group = input.required<Group>();
    size = input<'sm' | 'md' | 'lg'>('md');
    clickable = input<boolean>(false);

    // Outputs
    groupClick = output<Group>();

    // Computed color configuration
    readonly colorConfig = computed(() => {
        const g = this.group();
        return getGroupColorConfig(g?.color || 'blue');
    });

    onClick(): void {
        if (this.clickable()) {
            this.groupClick.emit(this.group());
        }
    }
}
