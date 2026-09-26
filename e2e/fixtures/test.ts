import { test as base } from '@playwright/test';

import { createVerifiedUser, loginViaApi, TestUser } from './api';

interface Fixtures {
  /** A fresh, verified user (not logged in). */
  user: TestUser;
  /** `user`, already logged in in this page's browser context. */
  loggedIn: TestUser;
}

export const test = base.extend<Fixtures>({
  page: async ({ page }, use) => {
    // The header weather widget calls a third-party API; keep tests hermetic.
    await page.route('https://api.open-meteo.com/**', (route) =>
      route.fulfill({
        json: { current: { temperature_2m: 20, wind_speed_10m: 5, weather_code: 0 } },
      }),
    );
    await use(page);
  },
  user: async ({ request }, use) => {
    await use(await createVerifiedUser(request));
  },
  loggedIn: async ({ page, user }, use) => {
    await loginViaApi(page.request, user);
    await use(user);
  },
});

export { expect } from '@playwright/test';
