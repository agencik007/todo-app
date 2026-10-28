import { test as base } from '@playwright/test';

import { createVerifiedUser, loginViaApi, TestUser } from './api';
import { weatherMock } from './weather';

interface Fixtures {
  /** A fresh, verified user (not logged in). */
  user: TestUser;
  /** `user`, already logged in in this page's browser context. */
  loggedIn: TestUser;
}

export const test = base.extend<Fixtures>({
  page: async ({ page }, use) => {
    // The header weather widget calls third-party APIs; keep tests hermetic.
    await page.route('https://api.open-meteo.com/**', (route) =>
      route.fulfill({ json: weatherMock.forecast }),
    );
    await page.route('https://geocoding-api.open-meteo.com/**', (route) =>
      route.fulfill({ json: weatherMock.cities }),
    );
    await page.route('https://api.bigdatacloud.net/**', (route) =>
      route.fulfill({ json: weatherMock.place }),
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
