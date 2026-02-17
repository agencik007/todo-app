import {
    Component,
    DestroyRef,
    effect,
    ElementRef,
    inject,
    signal,
    viewChild,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { LoginAvatarAnimationService } from '../../../core/services/login-avatar-animation.service';

type AnimationPhase = 'idle' | 'enter' | 'center' | 'burst' | 'done';

interface TargetPosition {
    x: number;
    y: number;
}

@Component({
    selector: 'app-login-avatar-animation',
    templateUrl: './login-avatar-animation.html',
    styleUrl: './login-avatar-animation.scss',
    imports: [TranslatePipe],
})
export class LoginAvatarAnimationComponent {
    readonly #animationService = inject(LoginAvatarAnimationService);
    readonly #destroyRef = inject(DestroyRef);

    readonly avatarUrl = this.#animationService.avatarUrl;
    readonly isAnimating = this.#animationService.isAnimating;
    readonly phase = signal<AnimationPhase>('idle');
    readonly targetPosition = signal<TargetPosition>({ x: 550, y: -200 });

    readonly overlayEl = viewChild<ElementRef<HTMLDivElement>>('overlay');

    readonly #timeouts: number[] = [];

    constructor() {
        effect(() => {
            if (this.isAnimating()) {
                this.#calculateTargetPosition();
                this.#startAnimation();
            }
        });

        this.#destroyRef.onDestroy(() => {
            this.#clearTimers();
        });
    }

    #calculateTargetPosition(): void {
        const targetAvatar = document.getElementById('nav-profile-avatar');
        if (!targetAvatar) return;

        const targetRect = targetAvatar.getBoundingClientRect();
        const overlayElement = this.overlayEl()?.nativeElement;
        if (!overlayElement) return;

        const overlayRect = overlayElement.getBoundingClientRect();
        const centerX = overlayRect.width / 2;
        const centerY = overlayRect.height / 2;

        const targetCenterX = targetRect.left + targetRect.width / 2;
        const targetCenterY = targetRect.top + targetRect.height / 2;

        const relativeX = targetCenterX - centerX;
        const relativeY = targetCenterY - centerY;

        this.targetPosition.set({ x: relativeX, y: relativeY });
    }

    #startAnimation(): void {
        this.#clearTimers();
        this.phase.set('enter');

        this.#queue(450, () => {
            this.phase.set('center');

            this.#queue(2000, () => {
                this.phase.set('burst');

                this.#queue(550, () => {
                    this.phase.set('done');

                    this.#queue(500, () => {
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
