import { Component, computed, effect, inject, signal } from '@angular/core';
import { LoginAvatarAnimationService } from '../../../core/services/login-avatar-animation.service';

type AnimationPhase = 'idle' | 'enter' | 'center' | 'done';

@Component({
    selector: 'app-login-avatar-animation',
    template: `
        @if (isAnimating()) {
            <div
                class="login-avatar-overlay"
                [class.phase-enter]="phase() === 'enter'"
                [class.phase-done]="phase() === 'done'"
                [class.phase-center]="phase() === 'center'"
            >
                <div class="backdrop"></div>

                <div class="avatar-stage">
                    <!-- Spinning ring -->
                    <div class="ring ring-1"></div>
                    <div class="ring ring-2"></div>
                    <div class="ring ring-3"></div>

                    <!-- Sparkle particles -->
                    <div class="sparkle sparkle-1"></div>
                    <div class="sparkle sparkle-2"></div>
                    <div class="sparkle sparkle-3"></div>
                    <div class="sparkle sparkle-4"></div>
                    <div class="sparkle sparkle-5"></div>
                    <div class="sparkle sparkle-6"></div>

                    <!-- Avatar image -->
                    <div class="avatar-container">
                        <img
                            class="avatar-img"
                            alt="User Avatar"
                            [src]="avatarUrl()"
                        />
                    </div>
                </div>
            </div>
        }
    `,
    styleUrl: './login-avatar-animation.scss',
    imports: [],
})
export class LoginAvatarAnimationComponent {
    readonly #animationService = inject(LoginAvatarAnimationService);

    readonly avatarUrl = this.#animationService.avatarUrl;
    readonly isAnimating = this.#animationService.isAnimating;
    readonly phase = signal<AnimationPhase>('idle');

    // Precomputed: only render when animating
    readonly shouldRender = computed(() => this.isAnimating());

    constructor() {
        effect(() => {
            if (this.isAnimating()) {
                this.#startAnimation();
            }
        });
    }

    #startAnimation(): void {
        // Phase 1: Enter (scale in)
        this.phase.set('enter');

        setTimeout(() => {
            // Phase 2: Center (pulse + rings spinning)
            this.phase.set('center');

            setTimeout(() => {
                // Phase 3: Done (fade out)
                this.phase.set('done');

                setTimeout(() => {
                    this.#animationService.done();
                    this.phase.set('idle');
                }, 300);
            }, 1500);
        }, 500);
    }
}
