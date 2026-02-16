import { Injectable, signal } from '@angular/core';

@Injectable({
    providedIn: 'root',
})
export class LoginAvatarAnimationService {
    readonly avatarUrl = signal<string | null>(null);
    readonly isAnimating = signal(false);

    trigger(avatarUrl: string): void {
        this.avatarUrl.set(avatarUrl);
        this.isAnimating.set(true);
    }

    done(): void {
        this.avatarUrl.set(null);
        this.isAnimating.set(false);
    }
}
