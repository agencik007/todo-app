import { expect, test } from '../fixtures/test';
import { TodosPage } from '../pages/todos.page';
import { WeatherPage } from '../pages/weather.page';

// The widget only shows with the location permission granted.
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
  await expect(weather.widget).toHaveAccessibleName(
    'Kraków – Clear sky, 20°C (feels like 19°C), wind 5 km/h. Show weather details',
  );
  await weather.widget.hover();
  await expect(page.getByRole('tooltip')).toHaveText(
    'Kraków – Clear sky, 20°C (feels like 19°C), wind 5 km/h',
  );

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
