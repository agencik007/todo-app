import { DOCUMENT, isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import {
  Component,
  DestroyRef,
  effect,
  inject,
  PLATFORM_ID,
  signal,
  untracked,
} from '@angular/core';
import { LoginAnimationService } from '../../../core/services/login-animation.service';
import {
  WeatherService,
  WeatherType,
} from '../../../core/services/weather.service';

interface WeatherScene {
  type: WeatherType;
  isDay: boolean;
  particles: Particle[];
  clouds: Particle[];
  stars: Particle[];
}

/**
 * Random placement of one animated element, passed to CSS as custom
 * properties. All values are 0–1 (drift -1–1); the SCSS scales them.
 */
interface Particle {
  x: number;
  y: number;
  delay: number;
  duration: number;
  size: number;
  drift: number;
}

/**
 * Full-screen weather scene played once after every forecast update (and on
 * demand from the widget): rain falls, the sun crosses the sky, snow drifts.
 * Purely decorative: no pointer events, hidden from assistive technology and
 * skipped for reduced motion or a hidden tab.
 */
@Component({
  selector: 'app-weather-effects',
  imports: [NgTemplateOutlet],
  templateUrl: './weather-effects.component.html',
  styleUrl: './weather-effects.component.scss',
})
export class WeatherEffectsComponent {
  readonly #weatherService = inject(WeatherService);
  readonly #loginAnimation = inject(LoginAnimationService);
  readonly #document = inject(DOCUMENT);
  readonly #isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  static readonly DURATION_MS = 7000;

  readonly scene = signal<WeatherScene | null>(null);

  readonly hasClearSky = hasClearSky;
  /** Drops that also leave a splash at the bottom edge. */
  readonly splashCount = 30;

  #pending = false;
  #timeoutId: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    // A new forecast or a replay request queues a scene.
    effect(() => {
      this.#weatherService.weather();
      this.#weatherService.replayRequests();
      this.#pending = true;
      untracked(() => this.#playPending());
    });

    // Never on top of the login animation: wait until it has finished.
    effect(() => {
      if (!this.#loginAnimation.isAnimating()) {
        untracked(() => this.#playPending());
      }
    });

    inject(DestroyRef).onDestroy(() => clearTimeout(this.#timeoutId));
  }

  #playPending(): void {
    const weather = this.#weatherService.weather();
    const type = this.#weatherService.weatherType();
    if (
      !this.#pending ||
      !weather ||
      !type ||
      this.#loginAnimation.isAnimating()
    ) {
      return;
    }
    this.#pending = false;
    if (!this.#canPlay()) {
      return;
    }

    clearTimeout(this.#timeoutId);
    // Restart from scratch when a scene is already running.
    this.scene.set(null);
    this.#timeoutId = setTimeout(() => {
      this.scene.set(createScene(type, weather.isDay));
      this.#timeoutId = setTimeout(
        () => this.scene.set(null),
        WeatherEffectsComponent.DURATION_MS,
      );
    });
  }

  #canPlay(): boolean {
    return (
      this.#isBrowser &&
      this.#weatherService.effectsEnabled() &&
      this.#document.visibilityState === 'visible' &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }
}

function createScene(type: WeatherType, isDay: boolean): WeatherScene {
  return {
    type,
    isDay,
    particles: createParticles(PARTICLE_COUNT[type] ?? 0),
    clouds: createParticles(CLOUD_COUNT[type] ?? 0),
    stars: createParticles(!isDay && hasClearSky(type) ? 45 : 0),
  };
}

/** The sun by day, the moon and stars by night. */
function hasClearSky(type: WeatherType): boolean {
  return type === 'sunny' || type === 'partly-cloudy';
}

/** Rain drops, snowflakes or fog bands. */
const PARTICLE_COUNT: Partial<Record<WeatherType, number>> = {
  rainy: 80,
  stormy: 110,
  snowy: 60,
  foggy: 4,
};

const CLOUD_COUNT: Partial<Record<WeatherType, number>> = {
  'partly-cloudy': 3,
  cloudy: 6,
  rainy: 5,
  stormy: 6,
  snowy: 4,
};

function createParticles(count: number): Particle[] {
  return Array.from({ length: count }, () => ({
    x: Math.random(),
    y: Math.random(),
    delay: Math.random(),
    duration: Math.random(),
    size: Math.random(),
    drift: Math.random() * 2 - 1,
  }));
}
