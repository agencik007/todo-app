import { Pipe, PipeTransform } from '@angular/core';
import { getGroupColorConfig } from '../../features/groups/config/group-colors.config';

@Pipe({
    name: 'groupColorHex',
    standalone: true,
})
export class GroupColorHexPipe implements PipeTransform {
    transform(color: string | undefined | null): string {
        if (!color) return '#3B82F6'; // Default blue
        return getGroupColorConfig(color).hex;
    }
}
