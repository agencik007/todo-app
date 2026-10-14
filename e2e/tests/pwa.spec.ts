import { BrowserContext } from '@playwright/test';

import { expect, test } from '../fixtures/test';
import { GuestNav, LoginPage } from '../pages/auth.pages';

// Runs in the `pwa` project, the only one with service workers allowed.

/**
 * Cuts the network for the pages *and* the service worker. In Chromium,
 * context.setOffline() alone doesn't stop the service worker's own fetches,
 * so a test could pass while the worker quietly loads files from the server.
 */
async function goOffline(context: BrowserContext): Promise<void> {
  await context.setOffline(true);
  await context.route('**/*', (route) => route.abort('internetdisconnected'));
}

test('the web app manifest is linked and its icons load', async ({ page, request }) => {
  await page.goto('/login');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBe('manifest.webmanifest');

  const response = await request.get(`/${href}`);
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toContain('application/manifest+json');

  const manifest = await response.json();
  expect(manifest).toMatchObject({
    name: 'Todo App',
    start_url: '/todos?source=pwa',
    display: 'standalone',
  });
  const purposes = manifest.icons.map((icon: { purpose: string }) => icon.purpose);
  expect(purposes).toEqual(expect.arrayContaining(['any', 'maskable']));
  for (const icon of manifest.icons) {
    expect((await request.get(`/${icon.src}`)).ok(), icon.src).toBe(true);
  }
});

test('service worker files are never cached by the browser', async ({ request }) => {
  // A long-cached ngsw.json or worker script would block updates and the
  // kill switch (deleting ngsw.json), see docs/pwa-plan.md.
  for (const file of ['ngsw-worker.js', 'ngsw.json', 'manifest.webmanifest']) {
    const response = await request.get(`/${file}`);
    expect(response.ok(), file).toBe(true);
    expect(response.headers()['cache-control'], file).toBe('no-cache');
  }
});

test('the app shell loads offline once the service worker is installed', async ({
  page,
  context,
}) => {
  const login = new LoginPage(page);
  await login.goto();
  await expect(login.heading).toBeVisible();

  // Registration waits until the app is stable (registerWhenStable:30000).
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await goOffline(context);
  await page.reload();

  // Rendered from the cached shell, with translations (not raw keys).
  await expect(login.heading).toBeVisible();
  await expect(page.getByRole('link', { name: 'Forgot password?' })).toBeVisible();

  // A language never loaded online comes from the precache too, although the
  // app requests it with a cache-busting query (pl.json?v=2).
  await new GuestNav(page).switchLanguage('Polski');
  await expect(page.getByRole('heading', { name: 'Zaloguj się' })).toBeVisible();
});
