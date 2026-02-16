import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { LoginAvatarAnimationService } from '../../../core/services/login-avatar-animation.service';

type AnimationPhase = 'idle' | 'enter' | 'center' | 'burst' | 'done';

@Component({
    selector: 'app-login-avatar-animation',
    templateUrl: './login-avatar-animation.html',
    styleUrl: './login-avatar-animation.scss',
    imports: [],
})
export class LoginAvatarAnimationComponent {
    readonly #animationService = inject(LoginAvatarAnimationService);
    readonly #destroyRef = inject(DestroyRef);

    readonly avatarUrl = this.#animationService.avatarUrl;
    readonly isAnimating = this.#animationService.isAnimating;
    readonly phase = signal<AnimationPhase>('idle');

    readonly #timeouts: number[] = [];

    constructor() {
        effect(() => {
            if (this.isAnimating()) {
                this.#startAnimation();
            }
        });

        this.#destroyRef.onDestroy(() => {
            this.#clearTimers();
        });
    }

    #startAnimation(): void {
        this.#clearTimers();
        this.phase.set('enter');

        this.#queue(450, () => {
            this.phase.set('center');

            this.#queue(900, () => {
                this.phase.set('burst');

                this.#queue(550, () => {
                    this.phase.set('done');

                    this.#queue(350, () => {
                        this.#animationService.done();
                        this.phase.set('idle');
                    });
                });
            });
        });
    }

    #queue(delayMs: number, callback: () => void): void {
        const timeoutId = window.setTimeout(callback, delayMs);
        this.#timeouts.push(timeoutId);
    }

    #clearTimers(): void {
        this.#timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
        this.#timeouts.length = 0;
    }
}
