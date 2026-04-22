import { Injectable, signal } from '@angular/core';

export type BackgroundType = 'off' | 'school' | 'modern';

@Injectable({
    providedIn: 'root',
})
export class BackgroundService {
    private readonly BACKGROUND_KEY = 'background_type_v2';
    private _type = signal<BackgroundType>(this.getInitialState());

    readonly type = this._type.asReadonly();

    setType(type: BackgroundType): void {
        this._type.set(type);
        if (typeof window !== 'undefined') {
            localStorage.setItem(this.BACKGROUND_KEY, type);
        }
    }

    toggle(): void {
        const current = this._type();
        let next: BackgroundType;

        switch (current) {
            case 'off':
                next = 'school';
                break;
            case 'school':
                next = 'modern';
                break;
            case 'modern':
                next = 'off';
                break;
            default:
                next = 'school';
        }

        this._type.set(next);
        if (typeof window !== 'undefined') {
            localStorage.setItem(this.BACKGROUND_KEY, next);
        }
    }

    private getInitialState(): BackgroundType {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(
                this.BACKGROUND_KEY,
            ) as BackgroundType;
            if (saved === 'off' || saved === 'school' || saved === 'modern') {
                return saved;
            }
            // Default to 'school' for first-time users (legacy compatibility)
            return 'school';
        }
        return 'off';
    }
}
