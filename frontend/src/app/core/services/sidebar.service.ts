import { Injectable, signal } from '@angular/core';

@Injectable({
    providedIn: 'root',
})
export class SidebarService {
    isMobileVisible = signal(false);

    toggleMobile(): void {
        this.isMobileVisible.update((v) => !v);
    }

    closeMobile(): void {
        if (this.isMobileVisible()) {
            this.isMobileVisible.set(false);
        }
    }

    openMobile(): void {
        if (!this.isMobileVisible()) {
            this.isMobileVisible.set(true);
        }
    }
}
