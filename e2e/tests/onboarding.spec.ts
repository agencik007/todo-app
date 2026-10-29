import { expect, test } from '../fixtures/test';
import { sidebarGroups } from '../pages/todos.page';
import { WelcomePage } from '../pages/welcome.page';

test.describe('a brand-new account', () => {
  // Polish, so the starter groups get the names the assertions use.
  test.use({ language: 'pl', onboarded: false });

  test.beforeEach(async ({ loggedIn }) => {
    void loggedIn;
  });

  test('first login shows welcome with 4 preselected tiles', async ({ page }) => {
    await page.goto('/todos');

    const welcome = new WelcomePage(page);
    await expect(page).toHaveURL(/\/welcome$/);
    await expect(welcome.heading).toBeVisible();
    await expect(welcome.selectedTiles).toHaveCount(4);
    for (const name of ['Dom', 'Praca', 'Zakupy', 'Hobby']) {
      await expect(welcome.tile(name)).toHaveAttribute('aria-pressed', 'true');
    }
    await expect(welcome.submit).toHaveText(/Zaczynamy \(4\)/);
  });

  test('submitting creates groups and lands on todos', async ({ page }) => {
    const welcome = new WelcomePage(page);
    await welcome.goto();

    await welcome.tile('Zdrowie').click();
    await welcome.tile('Hobby').click();
    await expect(welcome.tile('Zdrowie')).toHaveAttribute('aria-pressed', 'true');
    await expect(welcome.tile('Hobby')).toHaveAttribute('aria-pressed', 'false');
    await welcome.submit.click();

    await expect(page).toHaveURL(/\/todos$/);
    await expect(sidebarGroups(page)).toHaveText(['Dom', 'Praca', 'Zakupy', 'Zdrowie'], {
      useInnerText: true,
    });
  });

  test('skip lands on todos with no groups', async ({ page }) => {
    const welcome = new WelcomePage(page);
    await welcome.goto();
    await expect(welcome.selectedTiles).toHaveCount(4);

    await welcome.skip.click();

    await expect(page).toHaveURL(/\/todos$/);
    await expect(page.getByRole('heading', { name: /^Witaj/ })).toBeVisible();
    await expect(sidebarGroups(page)).toHaveCount(0);

    // Finished for good: /welcome now sends the user back to the list.
    await welcome.goto();
    await expect(page).toHaveURL(/\/todos$/);
  });

  test('mobile layout has no horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    const welcome = new WelcomePage(page);
    await welcome.goto();
    await expect(welcome.submit).toBeVisible();

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(320);
    await expect(welcome.submit).toBeInViewport();
  });
});

test('onboarded user visiting /welcome is redirected to /todos', async ({ page, loggedIn }) => {
  void loggedIn;
  await new WelcomePage(page).goto();

  await expect(page).toHaveURL(/\/todos$/);
});
