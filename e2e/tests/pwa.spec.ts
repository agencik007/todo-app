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
  expect(manifest.display_override).toEqual(['window-controls-overlay']);
  expect(manifest.shortcuts).toEqual([
    expect.objectContaining({ name: 'New task', url: '/todos?action=new' }),
  ]);
  const formFactors = manifest.screenshots.map((shot: { form_factor: string }) => shot.form_factor);
  expect(formFactors).toEqual(expect.arrayContaining(['narrow', 'wide']));

  const images: { src: string }[] = [
    ...manifest.icons,
    ...manifest.shortcuts.flatMap((shortcut: { icons: { src: string }[] }) => shortcut.icons),
    ...manifest.screenshots,
  ];
  for (const image of images) {
    expect((await request.get(`/${image.src}`)).ok(), image.src).toBe(true);
  }
});

test('iOS launch screens are linked and load', async ({ page, request }) => {
  await page.goto('/login');
  const hrefs = await page
    .locator('link[rel="apple-touch-startup-image"]')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
  expect(hrefs.length).toBeGreaterThan(0);
  for (const href of hrefs) {
    expect((await request.get(`/${href}`)).ok(), href).toBe(true);
  }
});

test('the "New task" shortcut opens the form once', async ({ page, loggedIn }) => {
  void loggedIn;
  const todos = new TodosPage(page);
  await page.goto('/todos?action=new');
  await expect(todos.dialog.getByRole('textbox', { name: /^Title/ })).toBeVisible();
  // The parameter is dropped, so a reload doesn't open the form again.
  await expect(page).toHaveURL(/\/todos$/);
  await todos.dialog.getByRole('textbox', { name: /^Title/ }).fill('From the shortcut');
  await todos.dialog.getByRole('button', { name: 'Add task' }).click();
  await expect(todos.row('From the shortcut')).toBeVisible();

  await page.reload();
  await expect(todos.row('From the shortcut')).toBeVisible();
  await expect(todos.dialog).toBeHidden();
});

test('the app icon shows the number of open tasks once turned on', async ({ page, loggedIn }) => {
  // Headless Chromium has no installed app to badge: record the calls instead.
  await page.addInitScript(() => {
    const calls: (number | null)[] = [];
    Object.assign(window, { badgeCalls: calls });
    Object.assign(navigator, {
      setAppBadge: async (count: number) => void calls.push(count),
      clearAppBadge: async () => void calls.push(null),
    });
  });
  const lastBadge = (): Promise<number | null | undefined> =>
    page.evaluate(() => (window as unknown as { badgeCalls: (number | null)[] }).badgeCalls.at(-1));

  const todos = new TodosPage(page);
  await todos.goto();
  await todos.add('First open task');
  await todos.add('Second open task');
  // Off by default.
  await expect.poll(lastBadge).toBeNull();

  const menu = new UserMenu(page);
  await menu.openSettings(loggedIn.email);
  await menu.appBadge.click();
  await expect.poll(lastBadge).toBe(2);
  await menu.open(loggedIn.email); // the trigger toggles: closes the menu

  await todos.toggle('First open task');
  await expect.poll(lastBadge).toBe(1);

  // Logging out clears it.
  await new UserMenu(page).logout(loggedIn.email);
  await expect.poll(lastBadge).toBeNull();
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

test('tasks changed offline are kept and sent once the connection is back', async ({
  page,
  context,
  loggedIn,
}) => {
  void loggedIn;
  const todos = new TodosPage(page);
  const offlineBanner = page.getByRole('status').filter({ hasText: 'You are offline.' });
  await todos.goto();
  await todos.add('Rename me');
  await todos.add('Finish me');
  await todos.add('Remove me');
  await expect
    .poll(() => offlineTodoTitles(page))
    .toEqual(['Rename me', 'Finish me', 'Remove me']);
  await installServiceWorker(page);

  await goOffline(context);
  await page.reload();
  await expect(offlineBanner).toBeVisible();

  // Every kind of change works offline; each todo keeps one queued change.
  await todos.add('Written offline');
  await todos.rename('Written offline', 'Written and edited offline');
  await todos.rename('Rename me', 'Renamed offline');
  await todos.toggle('Finish me');
  await todos.remove('Remove me');
  await expect(todos.row('Remove me')).toBeHidden();
  await expect(offlineBanner).toContainText('Waiting to sync: 4');
  await expect(todos.row('Renamed offline').getByRole('img', { name: 'Waiting to sync' })).toBeVisible();
  // Reordering needs the server.
  await expect(todos.row('Finish me').getByRole('button', { name: 'Drag to reorder' })).toBeHidden();

  // The queue survives a reload (it lives in IndexedDB).
  await page.reload();
  await expect(offlineBanner).toContainText('Waiting to sync: 4');
  await expect(todos.row('Written and edited offline')).toBeVisible();

  // Back online: the queue is sent and the server has every change.
  await goOnline(context);
  await expect(page.getByText('Changes made offline were saved (4).')).toBeVisible();
  await expect(offlineBanner).toBeHidden();
  await expect(page.getByRole('img', { name: 'Waiting to sync' })).toHaveCount(0);

  await page.reload();
  await expect(todos.row('Written and edited offline')).toBeVisible();
  await expect(todos.row('Renamed offline')).toBeVisible();
  await expect(todos.row('Finish me').getByRole('checkbox')).toBeChecked();
  await expect(todos.row('Remove me')).toBeHidden();
  await expect(todos.row('Rename me')).toBeHidden();
});

test('a create whose response was lost is retried without a duplicate', async ({
  page,
  context,
  loggedIn,
}) => {
  void loggedIn;
  const todos = new TodosPage(page);
  await todos.goto();
  await expect(todos.addButton()).toBeEnabled();

  // The server creates the todo, but the connection drops before the answer.
  await context.route(
    '**/todos',
    async (route) => {
      await route.fetch();
      await route.abort('internetdisconnected');
    },
    { times: 1 },
  );
  await todos.add('Sent twice');
  await expect(page.getByRole('status').filter({ hasText: 'You are offline.' })).toBeVisible();
  await expect(todos.row('Sent twice').getByRole('img', { name: 'Waiting to sync' })).toBeVisible();

  // Online again: the retry carries the same clientId and gets the same todo.
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(todos.row('Sent twice').getByRole('img', { name: 'Waiting to sync' })).toBeHidden();
  await page.reload();
  await expect(todos.row('Sent twice')).toHaveCount(1);
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

