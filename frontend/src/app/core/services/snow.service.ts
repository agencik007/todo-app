import { Injectable, signal } from '@angular/core';

@Injectable({
    providedIn: 'root',
})
export class SnowService {
    private readonly SNOW_KEY = 'snow_enabled';
    private _isEnabled = signal<boolean>(this.getInitialState());

    readonly isEnabled = this._isEnabled.asReadonly();

    toggle(): void {
        const newState = !this._isEnabled();
        this._isEnabled.set(newState);
        if (typeof window !== 'undefined') {
            localStorage.setItem(this.SNOW_KEY, JSON.stringify(newState));
        }
    }

    private getInitialState(): boolean {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(this.SNOW_KEY);
            return saved ? JSON.parse(saved) : false;
        }
        return false;
    }
}
