import { Injectable, signal } from '@angular/core';

@Injectable({
    providedIn: 'root',
})
@Injectable({
    providedIn: 'root',
})
export class LoginAnimationService {
    readonly isAnimating = signal(false);

    trigger(): void {
        this.isAnimating.set(true);
    }

    done(): void {
        this.isAnimating.set(false);
    }
}
