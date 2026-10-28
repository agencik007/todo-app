# Weather widget expansion plan

> **Status:** Phases 1 and 2 and Phase 3 items 1–2 implemented (see [Implementation notes](#implementation-notes-phases-1-and-2) and [Phase 3 notes](#implementation-notes-phase-3-items-12)); Phase 3 item 3 (units) and Phase 4 are proposals.
> **Scope:** `frontend/` (weather service, widget, new details dialog, i18n, privacy policy), `frontend/src/server.ts` (CSP), `e2e/`, docs. No backend changes.

The header weather widget today shows an icon and the temperature; its tooltip says `Temp: 20°C, Wind: 5 km/h` and a click replays the full-screen weather animation. This plan adds the place name, turns the click into a details dialog with hourly and 7-day forecasts, and lets users who deny geolocation pick a city. It is split into small PRs, because every merge to `develop` is a production release.

---

## Table of contents

1. [Current state](#1-current-state)
2. [Goals and non-goals](#2-goals-and-non-goals)
3. [Key decisions](#3-key-decisions)
4. [Phase 1 — place name and a better tooltip](#4-phase-1--place-name-and-a-better-tooltip)
5. [Phase 2 — details dialog](#5-phase-2--details-dialog)
6. [Phase 3 — manual location and preferences](#6-phase-3--manual-location-and-preferences)
7. [Phase 4 (optional) — extras](#7-phase-4-optional--extras)
8. [Testing](#8-testing)
9. [Documentation updates](#9-documentation-updates)
10. [PR breakdown](#10-pr-breakdown)
11. [Risks](#11-risks)
12. [Open questions](#12-open-questions)

---

## 1. Current state

| Area                                 | Today                                                                                                                                                            | Consequence                                                                                                                  |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `core/services/weather.service.ts`   | `httpResource` on `api.open-meteo.com/v1/forecast` with `current=temperature_2m,wind_speed_10m,weather_code,is_day`; `toWeatherType()` maps WMO codes to 7 types | Only "now" data; no forecast, no place, no time zone.                                                                        |
| `shared/components/weather-widget/`  | Button with a CSS icon + temperature; `pTooltip` built in a getter from `instant()`; click calls `replayEffect()`                                                | Tooltip has no place and no description of the weather ("light rain"). Click does something users can't predict from the UI. |
| Geolocation                          | `getCurrentPosition` on init and every 30 min; denied → `console.error`, widget stays hidden                                                                     | Users who deny location never see weather and can't choose a city.                                                           |
| `shared/components/weather-effects/` | Full-screen scene after each update and on replay                                                                                                                | Stays as is; replay moves into the dialog.                                                                                   |
| `server.ts` CSP                      | `connect-src 'self' <api> https://api.open-meteo.com`                                                                                                            | Every new host (geocoding, air quality) must be added here.                                                                  |
| Privacy policy (`LEGAL.*` in i18n)   | Says coordinates go only to Open-Meteo                                                                                                                           | Must be updated if coordinates go to another provider.                                                                       |
| `e2e/fixtures/test.ts`               | Mocks `api.open-meteo.com/**` with a minimal `current` object                                                                                                    | Mock must grow with the request; a new host needs its own mock.                                                              |

## 2. Goals and non-goals

### Goals

- **Place in the tooltip:** `Warszawa — light rain, 12°C (feels like 9°C), wind 18 km/h`.
- **Details dialog** on click: current conditions, next 24 hours, next 7 days, sunrise/sunset, UV, humidity, pressure, wind direction.
- **Works without geolocation:** search a city and remember it.
- **One request per refresh** to Open-Meteo, as today (current + hourly + daily in a single call).
- **Accessible:** keyboard, screen reader and reduced-motion friendly; the dialog is a real `role="dialog"` with focus management.

### Non-goals

- Weather alerts/push notifications, maps/radar, multiple saved cities (see Phase 4 for candidates).
- A backend proxy or storing location server-side.

## 3. Key decisions

### 3.1 Forecast data: extend the existing Open-Meteo call

One request, fields chosen for the dialog:

```
current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,
        weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,
        wind_gusts_10m,is_day
hourly=temperature_2m,weather_code,precipitation_probability,is_day
daily=weather_code,temperature_2m_max,temperature_2m_min,
      precipitation_probability_max,sunrise,sunset,uv_index_max
timezone=auto&forecast_days=7&forecast_hours=24
```

`timezone=auto` makes daily boundaries and sunrise/sunset local to the forecast place (not the browser), and `timeformat=unixtime` lets the dialog format every time in that zone with `Intl.DateTimeFormat`. The payload is a few KB every 30 minutes — no need to fetch the forecast lazily on dialog open.

`WeatherData` grows into `{ current, hourly: HourlyPoint[], daily: DailyPoint[], timezone }`, mapped from the snake_case response in the service so components never see Open-Meteo's shape.

### 3.2 Place name: reverse geocoding on the client

Open-Meteo's geocoding API is forward-only (name → coordinates), so the place name needs another provider. Options:

| Option                                                  | Pros                                                                                              | Cons                                                                                                     |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **BigDataCloud `reverse-geocode-client`** (recommended) | Free, no key, meant exactly for client-side use with device geolocation; `localityLanguage=pl/en` | New third party (CSP + privacy policy); terms forbid server-side or bulk use — fine here.                |
| Nominatim (OpenStreetMap)                               | Open data, well known                                                                             | Usage policy: max 1 req/s, identifying Referer/User-Agent, heavy use discouraged; better behind a proxy. |
| Backend proxy (`/api/weather/place`)                    | Coordinates stay first-party, cacheable                                                           | Backend code, rate limiting, OpenAPI regen — too much for a label.                                       |
| Time zone only (`timezone=auto`)                        | No new host                                                                                       | Only city-of-time-zone ("Warsaw" for all of Poland) — fallback only.                                     |

Rules:

- Send the coordinates exactly as the Geolocation API returned them: BigDataCloud's fair-use terms allow only live device coordinates (no stored, cached or altered ones).
- Cache `{ lat, lon, lang } → name` in `localStorage` (try/catch, like `EFFECTS_STORAGE_KEY`); re-query only when the rounded coordinates or the language change. In practice one request per user per place.
- Failure never hides the weather: fall back to "Your location" (the time-zone city was dropped — it names the wrong town for most of a country).
- Name shown: `city || locality`, plus `principalSubdivision` in the dialog subtitle ("Warszawa, Mazowieckie").

### 3.3 Weather descriptions: i18n per WMO code group

New `WEATHER.CODE.*` keys (EN + PL) for the ~15 WMO groups: clear, mainly clear, partly cloudy, overcast, fog, rime fog, drizzle (light/moderate/dense), freezing drizzle, rain (slight/moderate/heavy), freezing rain, snow (slight/moderate/heavy), snow grains, rain showers, snow showers, thunderstorm, thunderstorm with hail. A pure `weatherDescriptionKey(code)` function next to `toWeatherType()` keeps the mapping in one place.

### 3.4 Dialog: PrimeNG `p-dialog` with `premium-dialog`

Same pattern as the todo form (`styleClass="premium-dialog"`, `[modal]="true"`), so styling, focus trap, Escape and backdrop click come for free. On compact screens (`ScreenSizeService.isCompact()`) it opens as a bottom sheet (`position="bottom"`, full width, rounded top corners, max-height ~85vh with internal scroll).

### 3.5 Click behaviour

Click opens the dialog; "Replay animation" becomes a button in the dialog header. The widget gets `aria-haspopup="dialog"` and its `aria-label` becomes the tooltip text + "Show weather details". `WEATHER.REPLAY` stays (now used by the dialog button).

## 4. Phase 1 — place name and a better tooltip

Small, user-visible, fixes the reported gap.

1. `WeatherService`: add `timezone=auto`, `apparent_temperature`, `relative_humidity_2m`; expose `place = signal<string | null>`.
2. New `core/services/reverse-geocoding.service.ts` (BigDataCloud, cache, rounding, fallbacks per §3.2), called from `fetchWeather()` with the same coordinates; re-run on language change (`LanguageService`).
3. `WEATHER.CODE.*` descriptions (§3.3).
4. Tooltip becomes a `computed()` (reacts to language changes, unlike today's getter) with two lines:
   - **Warszawa**
   - Light rain · 12°C (feels like 9°C) · wind 18 km/h
5. CSP: add `https://api.bigdatacloud.net` to `connect-src` in `server.ts`.
6. Privacy policy (`LEGAL.*.LOCATION`, EN + PL): coordinates are also sent to BigDataCloud to show the place name; nothing stored by us.

## 5. Phase 2 — details dialog

New `shared/components/weather-widget/weather-details-dialog/` (component + SCSS), opened from the widget.

### Layout (top to bottom)

1. **Header:** place name (title) + subtitle "Updated 12 min ago" (relative time, refreshes every minute); icon buttons: refresh (`fetchWeather` again, spinner while `isLoading`), replay animation, close.
2. **Hero:** large animated icon (reuse `weather-icons.scss` scaled up via a size modifier), current temperature, description, "Feels like 9°C", today's ↑max / ↓min. Background gradient by `weatherType` × `isDay` (night = deep navy, sunny = warm, rain = blue-grey) using design tokens; text contrast checked in light and dark themes.
3. **Next 24 hours:** horizontal, scroll-snapping strip — hour, small icon, temperature, precipitation probability (shown only ≥ 20%), "Now" as the first item; sunrise/sunset inserted as their own items at the right hour. Optional: a thin temperature line (inline SVG polyline) above the strip.
4. **Next 7 days:** rows — day name ("Today", "Tomorrow", then weekday in the current language via `Intl.DateTimeFormat`), icon, rain chance, min temp, **range bar** (the week's min–max as the track, the day's range as the filled part, coloured cold→warm), max temp.
5. **Details grid** (2 columns on mobile, 3–4 on desktop), each tile icon + label + value + hint:
   - Humidity (+ dew point hint), wind (speed, gusts, direction arrow rotated by `wind_direction_10m`, compass label "NW"), pressure (hPa), precipitation (mm), cloud cover, UV index (with level: low/moderate/high/very high/extreme and a colour), sunrise/sunset.
6. **Footer:** "Weather data: Open-Meteo" link (their terms ask for attribution) + the "Weather animations" toggle moved/duplicated from the user menu.

### Behaviour

- Times formatted in the forecast's time zone (`timeZone` option of `Intl.DateTimeFormat`), 24h for `pl`, locale default for `en`.
- Loading: skeletons for the strip/rows; error: inline message with "Try again" — never a toast.
- _(Not done — open question 3.)_ Offline (`AuthStore.canWrite` false): show the last data with "Offline — data from 14:05" instead of hiding (keep the last response in `localStorage`, max ~6 h old).
- Reduced motion: icon animations off (they already respect it in the effects; apply the same to the dialog icon).
- Dialog content is a separate component so its code isn't loaded until first open (`@defer (on interaction)` around the dialog).

## 6. Phase 3 — manual location and preferences

1. _(Done.)_ **City search** in the dialog header ("Change location"): `p-autocomplete` on Open-Meteo geocoding (`https://geocoding-api.open-meteo.com/v1/search?name=…&count=5&language=pl`), debounced 300 ms, results "Kraków, Małopolskie, Poland". Choosing one stores `{ name, lat, lon }` in `localStorage` and stops using geolocation; "Use my location" switches back. CSP: add the geocoding host.
2. _(Done.)_ **Geolocation denied** → widget still renders as a small "Set location" button (cloud icon, no temperature) that opens the dialog on the search field. Today it silently disappears.
3. **Units** (in the dialog footer or user settings): °C/°F, km/h / m/s / mph — passed to Open-Meteo as `temperature_unit` / `wind_speed_unit`, stored in `localStorage`. Default from language (`pl` → °C, km/h).

## 7. Phase 4 (optional) — extras

Ideas ranked by value/effort, each its own PR:

- **"Today" hint line** under the hero, generated from the hourly data: "Rain expected from 15:00 — take an umbrella", "Clearing up after 18:00", "Hot afternoon, up to 31°C". Pure function of the forecast, i18n templates — no AI needed.
- **Precipitation chart** for the next hours (bars, mm/h) — Open-Meteo `minutely_15=precipitation` for the next 2 hours ("Rain stops in ~20 min").
- **Air quality** tile (European AQI + PM2.5) from `air-quality-api.open-meteo.com` (another CSP host).
- **Command palette** entries: "Show weather", "Replay weather animation".
- **Widget badge**: small warning dot when the next 3 hours bring a thunderstorm, heavy rain/snow or UV ≥ 8; the tooltip names it.
- **Moon phase / golden hour** in the sunrise/sunset tile.
- **Due-date weather** on todos — only if todos ever get due dates (they have none today).

## 8. Testing

- **e2e** (`e2e/AGENTS.md` rules):
  - Extend the open-meteo mock in `e2e/fixtures/test.ts` with `hourly`, `daily`, `timezone`; add a mock for the reverse-geocoding host (fixed city) and, in Phase 3, the geocoding search host — tests must stay hermetic.
  - New `weather.spec.ts`: tooltip shows the mocked city; click opens the dialog with 24 hourly items and 7 days; Escape closes it and focus returns to the widget; replay button triggers the effect; Phase 3: deny geolocation (`context.grantPermissions([])`) → "Set location" → search → choose → widget shows the chosen city after reload.
  - Mocked geolocation: `context.setGeolocation` + `permissions: ['geolocation']`.
- **Manual:** light/dark theme, PL/EN, compact (bottom sheet) and desktop, keyboard only, screen reader names of tiles, reduced motion, offline (`make prod`).
- **Checks:** `make lint-frontend`, `npm run format:check`, `ng build` (bundle budget — the dialog must be deferred), `make test-e2e`.

## 9. Documentation updates

- `README.md`: weather feature description (place name, dialog, manual location), third-party hosts in the security/CSP section.
- `frontend/AGENTS.md`: only if a new convention appears (e.g. "all weather hosts go through `WeatherService`, update CSP + privacy policy + e2e mocks together").
- `docs/pwa-plan.md`: the weather row (offline behaviour changes from "hide" to "show last data").
- Mark this plan's phases as done as they ship.

## 10. PR breakdown

| PR  | Title                                                               | Contents                                                                                                    |
| --- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 1   | `feat(frontend): show place name and conditions in weather tooltip` | §4: reverse geocoding service, WMO descriptions, computed tooltip, CSP, privacy policy, e2e mock + test     |
| 2   | `feat(frontend): add weather details dialog`                        | §5: forecast fields, dialog (hero, hourly, daily, details), replay moved into dialog, deferred loading, e2e |
| 3   | `feat(frontend): let users pick a weather location`                 | §6.1–6.2: city search, "Set location" state, e2e with denied geolocation                                    |
| 4   | `feat(frontend): add weather unit preferences`                      | §6.3                                                                                                        |
| 5+  | one per Phase 4 idea                                                | —                                                                                                           |

Each PR: Conventional Commits, EN + PL i18n, lint + build + e2e green.

## 11. Risks

| Risk                                                    | Mitigation                                                                                                                |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Reverse-geocoding provider changes terms or goes down   | Isolated in one service with fallbacks; swapping providers touches one file + CSP + privacy text.                         |
| Sharing location with an extra third party              | Looked up once per place (cached), disclosed in the privacy policy; the manual city mode sends no device location at all. |
| Bigger initial bundle                                   | Dialog behind `@defer`; icons are CSS already.                                                                            |
| Tooltip/dialog text drifts from the mocked data in e2e  | Assert on mocked values (fixed city, 20°C) only.                                                                          |
| Dialog visuals clash with the dynamic background/themes | Use design tokens only; check both themes and all background modes before merge.                                          |

## 12. Open questions

1. BigDataCloud vs Nominatim vs a backend proxy for the place name (recommendation: BigDataCloud, §3.2)?
2. Should "Weather animations" move into the dialog, or stay in the user menu as well?
3. Offline: show stale data (proposed) or keep hiding the widget as `pwa-plan.md` says today?
4. Which Phase 4 ideas are worth doing first?

---

## Implementation notes (Phases 1 and 2)

- `core/services/place-name.service.ts` (BigDataCloud, cached per ~1 km area and language under `localStorage.weather_place`); `WeatherService.loadForCurrentPosition()` asks for the position once and feeds both APIs; a language change looks the name up again.
- `WeatherService.forecast` keeps the last forecast during a refresh or after a failed one (the widget used to disappear for the length of every refresh).
- `shared/components/weather-widget/weather-icon/` is the icon (moon at night, still under reduced motion); `weather-details-dialog/` is the dialog, loaded with `@defer` on the first click (prefetched on hover). The "Weather animations" toggle is in the dialog footer and stays in the user menu.
- The widget still hides offline (`canWrite`), as `docs/pwa-plan.md` says.
- e2e: `e2e/tests/weather.spec.ts` with both APIs mocked in `e2e/fixtures/weather.ts`.

## Implementation notes (Phase 3, items 1–2)

- `core/services/location-search.service.ts` searches Open-Meteo geocoding (5 results, interface language; a failed search shows no results). The chosen city (`ChosenLocation`: name, region, coordinates) is stored under `localStorage.weather_location`; while it is set, no geolocation or BigDataCloud request is made and the language change does not look the name up again.
- `WeatherService.needsLocation` is true when no city is chosen and geolocation failed (denied, unavailable, unsupported). The widget then shows a map-marker icon button ("Set weather location") instead of hiding. A prompt the user has not answered yet still shows nothing.
- The dialog's search (`p-autocomplete`, 2+ characters, 300 ms) opens from the header's map-marker button, or by itself without a location, focused. "Use my location" forgets the city.
- A forecast is kept during a refresh only for the same coordinates, so switching places never shows the old place's weather under the new name.
- Focus returns to the widget when the dialog has finished closing (`onHide`): PrimeNG moves focus into the dialog only after its opening animation, and closing it before that used to leave focus on `<body>` (the e2e test was flaky).
