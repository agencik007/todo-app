import { Injectable, signal } from '@angular/core';

@Injectable({
    providedIn: 'root',
})
export class BackgroundService {
    private readonly BACKGROUND_KEY = 'background_enabled';
    private _isEnabled = signal<boolean>(this.getInitialState());

    readonly isEnabled = this._isEnabled.asReadonly();

    toggle(): void {
        const newState = !this._isEnabled();
        this._isEnabled.set(newState);
        if (typeof window !== 'undefined') {
            localStorage.setItem(this.BACKGROUND_KEY, JSON.stringify(newState));
        }
    }

    private getInitialState(): boolean {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(this.BACKGROUND_KEY);
            // Default to true for "wowed" effect, but user can disable it
            return saved ? JSON.parse(saved) : true;
        }
        return false;
    }
}
