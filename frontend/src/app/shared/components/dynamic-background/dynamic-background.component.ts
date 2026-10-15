import { Component, inject } from '@angular/core';
import { BackgroundService } from '../../../core/services/background.service';

interface Star {
  top: number;
  left: number;
  size: number;
  delay: number;
  duration: number;
}

// Small deterministic PRNG so the sparkles land in the same spots on every
// render (and on the server during SSR, avoiding hydration mismatches).
function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

function createStars(count: number): Star[] {
  const random = seededRandom(42);
  return Array.from({ length: count }, () => ({
    top: random() * 100,
    left: random() * 100,
    size: 1 + random() * 2.5,
    delay: random() * -8,
    duration: 3 + random() * 5,
  }));
}

@Component({
  selector: 'app-dynamic-background',
  imports: [],
  templateUrl: './dynamic-background.component.html',
  styleUrl: './dynamic-background.component.scss',
})
export class DynamicBackgroundComponent {
  readonly #backgroundService = inject(BackgroundService);
  readonly backgroundType = this.#backgroundService.type;

  readonly stars = createStars(36);
}
