import { BrowserContext, Page } from '@playwright/test';

import { expect, test } from '../fixtures/test';
import { GuestNav, LoginPage, UserMenu } from '../pages/auth.pages';
import { TodosPage } from '../pages/todos.page';

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

async function goOnline(context: BrowserContext): Promise<void> {
  await context.unrouteAll();
  await context.setOffline(false);
}

/** Todo titles in the offline snapshot (IndexedDB), or null when there is none. */
function offlineTodoTitles(page: Page): Promise<string[] | null> {
  return page.evaluate(
    () =>
      new Promise<string[] | null>((resolve) => {
        const open = indexedDB.open('TodoAppDB');
        open.onsuccess = (): void => {
          const db = open.result;
          if (!db.objectStoreNames.contains('offline')) {
            db.close();
            resolve(null);
            return;
          }
          const get = db.transaction('offline').objectStore('offline').get('snapshot');
          get.onsuccess = (): void => {
            const snapshot = get.result as { todos: { title: string }[] } | undefined;
            db.close();
            resolve(snapshot ? snapshot.todos.map((todo) => todo.title) : null);
          };
        };
      }),
  );
}

/** Waits until the service worker controls the page (app shell cached). */
async function installServiceWorker(page: Page): Promise<void> {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
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
  await installServiceWorker(page);

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

test('the user menu offers to install the app when the browser allows it', async ({
  page,
  loggedIn,
}) => {
  await page.goto('/todos');
  await expect(page.getByRole('heading', { name: /^Hello/ })).toBeVisible();
  const menu = new UserMenu(page);

  // No install prompt from the browser yet: nothing to offer.
  await menu.open(loggedIn.email);
  await expect(menu.installApp).toBeHidden();
  await menu.open(loggedIn.email); // the trigger toggles: closes the menu

  // Headless Chromium never fires beforeinstallprompt by itself, so fire one
  // whose prompt() records the call.
  await page.evaluate(() => {
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt: async () => {
        (window as unknown as { installPrompted: boolean }).installPrompted = true;
      },
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    });
    window.dispatchEvent(event);
  });

  await menu.open(loggedIn.email);
  await menu.installApp.click();
  const installPrompted = (): Promise<boolean | undefined> =>
    page.evaluate(() => (window as unknown as { installPrompted?: boolean }).installPrompted);
  await expect.poll(installPrompted).toBe(true);

  // The browser's prompt can be shown only once.
  await menu.open(loggedIn.email);
  await expect(menu.installApp).toBeHidden();
});

test('a signed-in user reads the last synced tasks offline, read-only', async ({
  page,
  context,
  loggedIn,
}) => {
  void loggedIn;
  const todos = new TodosPage(page);
  await todos.goto();
  await todos.add('Pack for the trip');
  await expect.poll(() => offlineTodoTitles(page)).toEqual(['Pack for the trip']);
  await installServiceWorker(page);

  await goOffline(context);
  await page.reload();

  // Still signed in, with the synced task, but nothing can be changed.
  await expect(page.getByRole('status').filter({ hasText: 'You are offline.' })).toBeVisible();
  await expect(todos.row('Pack for the trip')).toBeVisible();
  await expect(todos.row('Pack for the trip').getByRole('checkbox')).toBeDisabled();
  await expect(todos.addButton()).toBeDisabled();

  // Back online: the real session returns and changes work again.
  await goOnline(context);
  await expect(page.getByRole('status').filter({ hasText: 'You are offline.' })).toBeHidden();
  await expect(todos.addButton()).toBeEnabled();
  await todos.toggle('Pack for the trip');
});

test('logging out deletes the offline copy of the tasks', async ({ page, context, loggedIn }) => {
  const todos = new TodosPage(page);
  await todos.goto();
  await todos.add('Private task');
  await expect.poll(() => offlineTodoTitles(page)).toEqual(['Private task']);
  await installServiceWorker(page);

  await new UserMenu(page).logout(loggedIn.email);
  await expect(page).toHaveURL(/\/login$/);
  await expect.poll(() => offlineTodoTitles(page)).toBeNull();

  // Offline after logout: no session to restore, so no tasks to show.
  await goOffline(context);
  await page.goto('/todos');
  await expect(new LoginPage(page).heading).toBeVisible();
  await expect(page.getByText('Private task')).toBeHidden();
});

