import { expect, test } from '../fixtures/test';
import { TodosPage } from '../pages/todos.page';
import { WeatherPage } from '../pages/weather.page';

const KRAKOW_TOOLTIP = 'Kraków – Clear sky, 20°C (feels like 19°C), wind 5 km/h';

test.describe('with location access', () => {
  test.use({
    geolocation: { latitude: 50.06, longitude: 19.94 },
    permissions: ['geolocation'],
  });

  test('the widget names the place and opens the forecast details', async ({ page, loggedIn }) => {
    const placeRequest = page.waitForRequest('https://api.bigdatacloud.net/**');
    const todos = new TodosPage(page);
    const weather = new WeatherPage(page);
    await todos.goto();

    expect(new URL((await placeRequest).url()).searchParams.get('localityLanguage')).toBe('en');
    await expect(weather.widget).toHaveAccessibleName(`${KRAKOW_TOOLTIP}. Show weather details`);
    await weather.widget.hover();
    await expect(page.getByRole('tooltip')).toHaveText(KRAKOW_TOOLTIP);

    await weather.widget.click();
    await expect(weather.dialog).toBeVisible();
    await expect(weather.dialog).toContainText('Kraków');
    await expect(weather.dialog).toContainText('Lesser Poland Voivodeship');
    await expect(weather.dialog).toContainText('Feels like 19°C');

    // 24 hours plus the sunset and the next sunrise between them.
    await expect(weather.hourlyItems()).toHaveCount(26);
    await expect(weather.hourlyItems().first()).toContainText('Now');
    await expect(weather.hourlyItems().filter({ hasText: 'Sunset' })).toContainText('9:00 PM');

    await expect(weather.dailyItems()).toHaveCount(7);
    await expect(weather.dailyItems().nth(0)).toContainText('Today');
    await expect(weather.dailyItems().nth(1)).toContainText('Tomorrow');
    await expect(weather.dailyItems().nth(1)).toContainText('80%');

    await expect(weather.detail('Humidity')).toHaveText('55%');
    await expect(weather.detail('Pressure')).toHaveText('1015 hPa');
    await expect(weather.dialog).toContainText('From north-west, gusts 13 km/h');

    // The dialog takes focus once it has opened; Escape gives it back.
    await expect(weather.dialog.locator(':focus')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(weather.dialog).toBeHidden();
    await expect(weather.widget).toBeFocused();
  });

  test('a chosen city replaces the device location until the user switches back', async ({
    page,
    loggedIn,
  }) => {
    const weather = new WeatherPage(page);
    await new TodosPage(page).goto();
    await weather.widget.click();
    await expect(weather.title()).toHaveText('Kraków');

    await weather.changeLocationButton().click();
    await expect(weather.citySearch()).toBeFocused();
    await weather.chooseCity('Gda', 'Gdańsk, Pomerania, Poland');
    await expect(weather.title()).toHaveText('Gdańsk');
    await expect(weather.citySearch()).toBeHidden();

    await weather.changeLocationButton().click();
    await weather.useMyLocationButton().click();
    await expect(weather.title()).toHaveText('Kraków');
  });
});

test.describe('without location access', () => {
  test('the user picks a city instead and it is remembered', async ({ page, loggedIn }) => {
    // Playwright can only grant permissions; without a grant the request
    // waits for an answer forever. Answer the way a denied prompt does.
    await page.addInitScript(() => {
      navigator.geolocation.getCurrentPosition = (_success, error) =>
        error?.({ code: 1, message: 'User denied Geolocation' } as GeolocationPositionError);
    });
    const weather = new WeatherPage(page);
    await new TodosPage(page).goto();

    await weather.setLocationButton().click();
    await expect(weather.dialog).toContainText('Location access is off');
    await expect(weather.citySearch()).toBeFocused();

    const search = page.waitForRequest('https://geocoding-api.open-meteo.com/**');
    await weather.chooseCity('Gda', 'Gdańsk, Pomerania, Poland');
    const params = new URL((await search).url()).searchParams;
    expect(params.get('name')).toBe('Gda');
    expect(params.get('language')).toBe('en');

    await expect(weather.title()).toHaveText('Gdańsk');
    await expect(weather.dialog).toContainText('Clear sky');
    await page.keyboard.press('Escape');
    await expect(weather.widget).toHaveAccessibleName(/^Gdańsk – Clear sky/);

    // Remembered on the device: no geolocation, no place lookup.
    const forecast = page.waitForRequest('https://api.open-meteo.com/**');
    await page.reload();
    expect(new URL((await forecast).url()).searchParams.get('latitude')).toBe('54.35');
    await expect(weather.widget).toHaveAccessibleName(/^Gdańsk – Clear sky/);
  });
});
