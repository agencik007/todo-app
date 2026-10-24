import { Component, computed, input } from '@angular/core';
import { WeatherType } from '../../../../core/models/weather.model';

/**
 * Animated CSS weather icon, drawn at 40 px and scaled to `size` (px).
 * Decorative unless a `label` is given.
 */
@Component({
  selector: 'app-weather-icon',
  host: {
    '[style.--scale]': 'size() / 40',
    '[attr.role]': "label() ? 'img' : null",
    '[attr.aria-label]': 'label()',
    '[attr.aria-hidden]': "label() ? null : 'true'",
  },
  templateUrl: './weather-icon.component.html',
  styleUrl: './weather-icon.component.scss',
})
export class WeatherIconComponent {
  readonly type = input.required<WeatherType>();
  readonly isDay = input(true);
  readonly size = input(40);
  readonly label = input<string | null>(null);

  /** Clear and partly cloudy skies show the moon at night. */
  readonly isNight = computed(() => !this.isDay());
}
