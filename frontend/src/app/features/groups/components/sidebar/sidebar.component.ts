import { UpperCasePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Group, GroupCreate, GroupUpdate } from '@api';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';
import { ScreenSizeService } from '../../../../core/services/screen-size.service';
import { SidebarService } from '../../../../core/services/sidebar.service';
import { GroupColorHexPipe } from '../../../../shared/pipes/group-color-hex.pipe';
import { GroupStore } from '../../store/group.store';
import { GroupFormComponent } from '../group-form/group-form.component';

@Component({
    selector: 'app-sidebar',
    imports: [
        UpperCasePipe,
        FormsModule,
        GroupFormComponent,
        GroupColorHexPipe,
        ButtonModule,
        CheckboxModule,
        ConfirmDialogModule,
        DialogModule,
        TranslatePipe,
        TooltipModule,
    ],
    providers: [ConfirmationService],
    templateUrl: './sidebar.html',
    styleUrl: './sidebar.scss',
})
export class SidebarComponent {
    readonly #groupStore = inject(GroupStore);
    readonly #confirmationService = inject(ConfirmationService);
    readonly #translate = inject(TranslateService);
    protected readonly sidebarService = inject(SidebarService);
    protected readonly screenSize = inject(ScreenSizeService);

    readonly groups = this.#groupStore.groups;
    readonly selectedGroupIds = this.#groupStore.selectedGroupIds;
    readonly hasSelection = this.#groupStore.hasSelection;
    readonly loading = this.#groupStore.loading;

    isDialogVisible = signal(false);
    isCollapsed = signal(false);
    groupsExpanded = signal(true);

    // For edit mode
    editingGroup = signal<Group | null>(null);

    // ==================== Dialog methods ====================

    showAddDialog(event: Event): void {
        event.stopPropagation();
        this.editingGroup.set(null);
        this.isDialogVisible.set(true);
    }

    showEditDialog(event: Event, group: Group): void {
        event.stopPropagation();
        this.editingGroup.set(group);
        this.isDialogVisible.set(true);
    }

    hideDialog(): void {
        this.isDialogVisible.set(false);
        this.editingGroup.set(null);
    }

    onSaveGroup(data: GroupCreate | GroupUpdate): void {
        const editing = this.editingGroup();
        if (editing) {
            this.#groupStore.updateGroup(editing.id, data as GroupUpdate);
        } else {
            this.#groupStore.createGroup(data as GroupCreate);
        }
        this.hideDialog();
    }

    // ==================== Delete methods ====================

    confirmDeleteGroup(event: Event, group: Group): void {
        event.stopPropagation();
        this.#confirmationService.confirm({
            message: this.#translate.instant(
                'GROUPS.MESSAGES.DELETE_CONFIRM_MESSAGE',
                { name: group.name },
            ),
            header: this.#translate.instant(
                'GROUPS.MESSAGES.DELETE_CONFIRM_TITLE',
            ),
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: this.#translate.instant('GROUPS.FORM.SUBMIT_DELETE'),
            rejectLabel: this.#translate.instant('GROUPS.FORM.CANCEL'),
            accept: () => {
                this.#groupStore.deleteGroup(group.id);
            },
        });
    }

    // ==================== Selection methods ====================

    toggleGroupSelection(
        event: { originalEvent?: Event },
        groupId: number,
    ): void {
        event.originalEvent?.stopPropagation();
        this.#groupStore.toggleGroupSelection(groupId);
    }

    isGroupSelected(groupId: number): boolean {
        return this.#groupStore.isGroupSelected(groupId);
    }

    clearSelection(event: Event): void {
        event.stopPropagation();
        this.#groupStore.clearSelection();
    }

    // ==================== UI methods ====================

    toggleCollapse(): void {
        if (this.screenSize.isMobile()) {
            this.sidebarService.closeMobile();
        } else {
            this.isCollapsed.update((v) => !v);
        }
    }

    toggleGroups(event: Event): void {
        event.stopPropagation();
        this.groupsExpanded.update((v) => !v);
    }

    get dialogTitle(): string {
        return this.editingGroup()
            ? 'GROUPS.FORM.TITLE_EDIT'
            : 'GROUPS.FORM.TITLE_CREATE';
    }
}
