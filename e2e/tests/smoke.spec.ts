import { expect, test } from '../fixtures/test';

test('an anonymous visitor is sent to the login page', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
});

test('pages load without Content-Security-Policy violations', async ({ page, loggedIn }) => {
  // Regression: critical-CSS inlining loads the global stylesheet through an
  // inline onload handler, which the SSR server's CSP blocks - the app then
  // renders without global styles.
  const violations: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && /Content Security Policy/i.test(message.text())) {
      violations.push(message.text());
    }
  });

  await page.goto('/login');
  await page.goto('/todos');
  await expect(page.getByRole('heading', { name: /^Hello/ })).toBeVisible();

  expect(violations).toEqual([]);
});
