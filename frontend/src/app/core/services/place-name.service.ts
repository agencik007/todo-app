import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { Place } from '../models/weather.model';

/** Shape of the BigDataCloud reverse-geocode-client response (fields we use). */
interface ReverseGeocodeResponse {
  city: string;
  locality: string;
  principalSubdivision: string;
  countryName: string;
}

interface CachedPlace {
  key: string;
  place: Place;
}

/**
 * Turns the device's coordinates into a place name for the weather widget.
 *
 * BigDataCloud's free client-side API may only be called from the device with
 * coordinates fresh from the Geolocation API, so callers pass the position
 * they just received. The answer is remembered for the area (~1 km) and
 * language, so a 30-minute refresh at the same place sends nothing.
 */
@Injectable({
  providedIn: 'root',
})
export class PlaceNameService {
  readonly #http = inject(HttpClient);

  static readonly STORAGE_KEY = 'weather_place';

  readonly #apiUrl = 'https://api.bigdatacloud.net/data/reverse-geocode-client';

  readonly #place = signal<Place | null>(null);
  /** Null until known, or when the lookup failed. */
  readonly place = this.#place.asReadonly();

  #request: Subscription | undefined;

  lookup(latitude: number, longitude: number, lang: string): void {
    const key = `${latitude.toFixed(2)},${longitude.toFixed(2)},${lang}`;
    const cached = this.#loadCached();
    if (cached?.key === key) {
      this.#place.set(cached.place);
      return;
    }

    this.#request?.unsubscribe();
    this.#request = this.#http
      .get<ReverseGeocodeResponse>(this.#apiUrl, {
        params: { latitude, longitude, localityLanguage: lang },
      })
      .subscribe({
        next: (response) => {
          const place = toPlace(response);
          this.#place.set(place);
          if (place) this.#saveCached({ key, place });
        },
        error: () => this.#place.set(null),
      });
  }

  #loadCached(): CachedPlace | null {
    try {
      const raw = localStorage.getItem(PlaceNameService.STORAGE_KEY);
      return raw ? (JSON.parse(raw) as CachedPlace) : null;
    } catch {
      return null;
    }
  }

  #saveCached(cached: CachedPlace): void {
    try {
      localStorage.setItem(
        PlaceNameService.STORAGE_KEY,
        JSON.stringify(cached),
      );
    } catch {
      // Storage blocked: the name is looked up again on the next refresh.
    }
  }
}

function toPlace(response: ReverseGeocodeResponse): Place | null {
  const name = response.city || response.locality;
  if (!name) return null;
  const region = response.principalSubdivision || response.countryName;
  return { name, region: region && region !== name ? region : null };
}
