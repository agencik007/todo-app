import {
  Component,
  computed,
  effect,
  inject,
  model,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { DialogModule } from 'primeng/dialog';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TooltipModule } from 'primeng/tooltip';
import { WeatherType } from '../../../../core/models/weather.model';
import { LanguageService } from '../../../../core/services/language.service';
import { ScreenSizeService } from '../../../../core/services/screen-size.service';
import {
  toWeatherType,
  weatherDescriptionKey,
  WeatherService,
} from '../../../../core/services/weather.service';
import { IconButtonDirective } from '../../../ui/icon-button/icon-button.directive';
import { WeatherIconComponent } from '../weather-icon/weather-icon.component';

type HourlyItem =
  | {
      kind: 'hour';
      time: number;
      label: string;
      type: WeatherType;
      isDay: boolean;
      description: string;
      temperature: number;
      /** Shown only when rain is reasonably likely. */
      precipitationProbability: number | null;
    }
  | { kind: 'sunrise' | 'sunset'; time: number; label: string };

interface DailyItem {
  date: number;
  label: string;
  type: WeatherType;
  description: string;
  temperatureMin: number;
  temperatureMax: number;
  precipitationProbability: number | null;
  /** Position of the day's range on the week's range bar (%). */
  rangeStart: number;
  rangeWidth: number;
}

interface DetailTile {
  icon: string;
  label: string;
  value: string;
  hint: string | null;
  /** Wind arrow rotation in degrees (where the wind blows to). */
  arrow?: number;
}

const HOUR_MS = 60 * 60 * 1000;
/** Lower rain chances are noise in the hourly strip and the week list. */
const MIN_SHOWN_PRECIPITATION = 20;

/**
 * Forecast for the widget's place: now, the next 24 hours, 7 days and the
 * details (wind, UV, pressure…). Opens from the header weather widget.
 */
@Component({
  selector: 'app-weather-details-dialog',
  imports: [
    DialogModule,
    FormsModule,
    ToggleSwitchModule,
    TooltipModule,
    TranslatePipe,
    IconButtonDirective,
    WeatherIconComponent,
  ],
  templateUrl: './weather-details-dialog.component.html',
  styleUrl: './weather-details-dialog.component.scss',
})
export class WeatherDetailsDialogComponent {
  readonly #weatherService = inject(WeatherService);
  readonly #translate = inject(TranslateService);
  readonly #languageService = inject(LanguageService);
  readonly #screenSize = inject(ScreenSizeService);

  readonly visible = model(false);

  /** The dialog has finished closing (after its animation). */
  readonly closed = output<void>();

  readonly forecast = this.#weatherService.forecast;
  readonly place = this.#weatherService.place;
  readonly isLoading = this.#weatherService.isLoading;
  readonly effectsEnabled = this.#weatherService.effectsEnabled;
  readonly isCompact = this.#screenSize.isCompact;
  /** Clock for "Updated 5 minutes ago"; ticks only while the dialog is open. */
  readonly now = signal(Date.now());

  readonly title = computed(() => {
    this.#languageService.currentLang();
    return (
      this.place()?.name ?? this.#translate.instant('WEATHER.YOUR_LOCATION')
    );
  });

  readonly updatedText = computed(() => {
    const forecast = this.forecast();
    if (!forecast) return '';
    const lang = this.#languageService.currentLang();
    const minutes = Math.floor((this.now() - forecast.receivedAt) / 60_000);
    if (minutes < 1) return this.#translate.instant('WEATHER.UPDATED_JUST_NOW');
    const time = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' }).format(
      -minutes,
      'minute',
    );
    return this.#translate.instant('WEATHER.UPDATED', { time });
  });

  readonly hero = computed(() => {
    const forecast = this.forecast();
    if (!forecast) return null;
    this.#languageService.currentLang();
    const { current } = forecast;
    const today = forecast.daily[0];
    return {
      type: toWeatherType(current.weatherCode),
      isDay: current.isDay,
      temperature: Math.round(current.temperature),
      description: this.#translate.instant(
        weatherDescriptionKey(current.weatherCode),
      ),
      feelsLike: Math.round(current.apparentTemperature),
      max: today ? Math.round(today.temperatureMax) : null,
      min: today ? Math.round(today.temperatureMin) : null,
    };
  });

  readonly hourly = computed<HourlyItem[]>(() => {
    const forecast = this.forecast();
    if (!forecast?.hourly.length) return [];
    this.#languageService.currentLang();
    const formatTime = this.#timeFormatter(forecast.timeZone);
    const hours = forecast.hourly;

    const items: HourlyItem[] = hours.map((hour, index) => ({
      kind: 'hour',
      time: hour.time,
      label:
        index === 0
          ? this.#translate.instant('WEATHER.NOW')
          : formatTime(hour.time),
      type: toWeatherType(hour.weatherCode),
      isDay: hour.isDay,
      description: this.#translate.instant(
        weatherDescriptionKey(hour.weatherCode),
      ),
      temperature: Math.round(hour.temperature),
      precipitationProbability: shownProbability(hour.precipitationProbability),
    }));

    // Sunrise and sunset between the hours, as their own items.
    const start = hours[0].time;
    const end = hours[hours.length - 1].time + HOUR_MS;
    for (const day of forecast.daily) {
      for (const kind of ['sunrise', 'sunset'] as const) {
        const time = day[kind];
        if (time > start && time < end) {
          items.push({ kind, time, label: formatTime(time) });
        }
      }
    }
    return items.sort((a, b) => a.time - b.time);
  });

  readonly daily = computed<DailyItem[]>(() => {
    const forecast = this.forecast();
    if (!forecast?.daily.length) return [];
    const lang = this.#languageService.currentLang();
    const weekday = new Intl.DateTimeFormat(lang, {
      weekday: 'long',
      timeZone: forecast.timeZone,
    });
    const days = forecast.daily;
    const weekMin = Math.min(...days.map((day) => day.temperatureMin));
    const weekMax = Math.max(...days.map((day) => day.temperatureMax));
    const span = weekMax - weekMin || 1;

    return days.map((day, index) => {
      const name =
        index === 0
          ? this.#translate.instant('WEATHER.TODAY')
          : index === 1
            ? this.#translate.instant('WEATHER.TOMORROW')
            : weekday.format(day.date);
      return {
        date: day.date,
        label: name.charAt(0).toUpperCase() + name.slice(1),
        type: toWeatherType(day.weatherCode),
        description: this.#translate.instant(
          weatherDescriptionKey(day.weatherCode),
        ),
        temperatureMin: Math.round(day.temperatureMin),
        temperatureMax: Math.round(day.temperatureMax),
        precipitationProbability: shownProbability(
          day.precipitationProbability,
        ),
        rangeStart: ((day.temperatureMin - weekMin) / span) * 100,
        rangeWidth: ((day.temperatureMax - day.temperatureMin) / span) * 100,
      };
    });
  });

  readonly details = computed<DetailTile[]>(() => {
    const forecast = this.forecast();
    if (!forecast) return [];
    const lang = this.#languageService.currentLang();
    const t = (key: string, params?: object): string =>
      this.#translate.instant(key, params);
    const number = new Intl.NumberFormat(lang, { maximumFractionDigits: 1 });
    const formatTime = this.#timeFormatter(forecast.timeZone);
    const { current } = forecast;
    const today = forecast.daily[0];

    const tiles: DetailTile[] = [
      {
        icon: 'pi-compass',
        label: t('WEATHER.DETAILS.WIND'),
        value: `${Math.round(current.windSpeed)} km/h`,
        hint: t('WEATHER.DETAILS.WIND_HINT', {
          direction: t(
            `WEATHER.COMPASS.${compassPoint(current.windDirection)}`,
          ),
          gusts: Math.round(current.windGusts),
        }),
        arrow: (current.windDirection + 180) % 360,
      },
      {
        icon: 'pi-percentage',
        label: t('WEATHER.DETAILS.HUMIDITY'),
        value: `${Math.round(current.humidity)}%`,
        hint: null,
      },
      {
        icon: 'pi-gauge',
        label: t('WEATHER.DETAILS.PRESSURE'),
        value: `${Math.round(current.pressure)} hPa`,
        hint: null,
      },
      {
        icon: 'pi-cloud-download',
        label: t('WEATHER.DETAILS.PRECIPITATION'),
        value: `${number.format(current.precipitation)} mm`,
        hint: null,
      },
      {
        icon: 'pi-cloud',
        label: t('WEATHER.DETAILS.CLOUD_COVER'),
        value: `${Math.round(current.cloudCover)}%`,
        hint: null,
      },
    ];

    if (today?.uvIndexMax != null) {
      tiles.push({
        icon: 'pi-sun',
        label: t('WEATHER.DETAILS.UV_INDEX'),
        value: number.format(today.uvIndexMax),
        hint: t(`WEATHER.UV.${uvLevel(today.uvIndexMax)}`),
      });
    }
    if (today) {
      tiles.push(
        {
          icon: 'pi-arrow-circle-up',
          label: t('WEATHER.DETAILS.SUNRISE'),
          value: formatTime(today.sunrise),
          hint: null,
        },
        {
          icon: 'pi-arrow-circle-down',
          label: t('WEATHER.DETAILS.SUNSET'),
          value: formatTime(today.sunset),
          hint: null,
        },
      );
    }
    return tiles;
  });

  constructor() {
    effect((onCleanup) => {
      if (!this.visible()) return;
      this.now.set(Date.now());
      const id = setInterval(() => this.now.set(Date.now()), 30_000);
      onCleanup(() => clearInterval(id));
    });
  }

  /** Hours in the forecast place's time zone, e.g. "14:00" / "2:00 PM". */
  #timeFormatter(timeZone: string): (time: number) => string {
    const format = new Intl.DateTimeFormat(
      this.#languageService.currentLang(),
      { hour: 'numeric', minute: '2-digit', timeZone },
    );
    return (time) => format.format(time);
  }

  onRefresh(): void {
    this.#weatherService.loadForCurrentPosition();
  }

  onReplay(): void {
    this.visible.set(false);
    this.#weatherService.replayEffect();
  }

  onEffectsChange(enabled: boolean): void {
    this.#weatherService.setEffectsEnabled(enabled);
  }
}

function shownProbability(probability: number | null): number | null {
  return probability !== null && probability >= MIN_SHOWN_PRECIPITATION
    ? Math.round(probability)
    : null;
}

/** 8-point compass key for a direction in degrees. */
function compassPoint(degrees: number): string {
  const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return points[Math.round((((degrees % 360) + 360) % 360) / 45) % 8];
}

/** WHO UV index categories. */
function uvLevel(index: number): string {
  if (index < 3) return 'LOW';
  if (index < 6) return 'MODERATE';
  if (index < 8) return 'HIGH';
  if (index < 11) return 'VERY_HIGH';
  return 'EXTREME';
}
