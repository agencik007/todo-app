import { Injectable, signal } from '@angular/core';

export type BackgroundType = 'off' | 'aurora' | 'modern';

const BACKGROUND_TYPES: readonly BackgroundType[] = ['off', 'aurora', 'modern'];

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
    const current = BACKGROUND_TYPES.indexOf(this._type());
    this.setType(BACKGROUND_TYPES[(current + 1) % BACKGROUND_TYPES.length]);
  }

  private getInitialState(): BackgroundType {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(this.BACKGROUND_KEY);
      if (BACKGROUND_TYPES.includes(saved as BackgroundType)) {
        return saved as BackgroundType;
      }
      // First-time users, and those who had the retired 'school' theme,
      // get the aurora.
      return 'aurora';
    }
    return 'off';
  }
}
