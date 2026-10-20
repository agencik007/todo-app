import { newUser, registerUser, VERIFY_EMAIL_PATH } from '../fixtures/api';
import { waitForEmailLink } from '../fixtures/mailhog';
import { expect, test } from '../fixtures/test';
import { GuestNav, LoginPage, RegisterPage, UserMenu } from '../pages/auth.pages';
import { TodosPage } from '../pages/todos.page';

test('a new user registers, verifies the email, logs in and logs out', async ({
  page,
  request,
}) => {
  const user = newUser();

  await new RegisterPage(page).goto();
  await new RegisterPage(page).register(user);
  await expect(page).toHaveURL(/\/check-email/);

  const verifyPath = await waitForEmailLink(request, user.email, VERIFY_EMAIL_PATH);
  await page.goto(verifyPath);
  await expect(page).toHaveURL(/\/login\?verified=success/);

  await new LoginPage(page).login(user);
  await expect(page).toHaveURL(/\/todos/);
  await expect(new TodosPage(page).greeting()).toBeVisible();

  await page.getByRole('button', { name: user.email }).click();
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page).toHaveURL(/\/login/);
});

test('login is rejected with a wrong password', async ({ page, user }) => {
  const login = new LoginPage(page);
  await login.goto();
  await login.login({ ...user, password: `${user.password}-wrong` });

  await expect(login.error).toContainText(/invalid e-?mail or password/i);
  await expect(page).toHaveURL(/\/login/);
});

test('login is rejected until the email is verified', async ({ page, request }) => {
  const user = newUser();
  await registerUser(request, user);

  const login = new LoginPage(page);
  await login.goto();
  await login.login(user);

  await expect(page.getByText(/not verified/i).first()).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test('a logged-in session survives a page reload', async ({ page, loggedIn }) => {
  const todos = new TodosPage(page);
  await todos.goto();
  await expect(todos.greeting()).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/\/todos/);
  await expect(todos.greeting()).toBeVisible();
  await expect(page.getByRole('button', { name: loggedIn.email })).toBeVisible();
});

test('a user deletes their account and can no longer log in', async ({ page, loggedIn }) => {
  const todos = new TodosPage(page);
  await todos.goto();
  await expect(todos.greeting()).toBeVisible();

  await new UserMenu(page).deleteAccount(loggedIn);
  await expect(page).toHaveURL(/\/login/);

  const login = new LoginPage(page);
  await login.login(loggedIn);
  await expect(login.error).toContainText(/invalid e-?mail or password/i);
});

test('the privacy policy is public and linked from the login page', async ({ page }) => {
  const login = new LoginPage(page);
  await login.goto();
  await page.getByRole('link', { name: 'Privacy policy' }).click();

  await expect(page).toHaveURL(/\/privacy/);
  await expect(page.getByRole('heading', { name: 'Privacy policy' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your rights' })).toBeAttached();
});

test('the privacy policy opens at the top, not scrolled to its Back button', async ({ page }) => {
  await page.goto('/privacy');
  const back = page.getByRole('button', { name: 'Back' });

  // PrimeNG rendered `autofocus` on every p-button; whether the browser acts on
  // it depends on timing, so check the attribute itself, not just the focus.
  await expect(back).not.toHaveAttribute('autofocus');
  await expect(back).not.toBeFocused();
  await expect(page.getByRole('heading', { name: 'Privacy policy' })).toBeInViewport();
});

test('the privacy policy survives cookie-banner blockers', async ({ page }) => {
  await page.goto('/privacy');
  // A generic rule from the "I don't care about cookies" extension, which used
  // to hide the page's whole container.
  await page.addStyleTag({
    content: `.privacy-container:not(body):not(html):not(.content-container),
      .privacy-card, .privacy-header, .privacy-section { display: none !important; }`,
  });

  await expect(page.getByRole('heading', { name: 'Privacy policy' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your rights' })).toBeVisible();
});

test('login and register center their footer links the same way', async ({ page }) => {
  for (const path of ['/login', '/register']) {
    await page.goto(path);
    // The title spans the whole card, so its middle is the card's middle.
    const card = await page.getByRole('heading', { level: 1 }).boundingBox();
    const privacy = await page.getByRole('link', { name: 'Privacy policy' }).boundingBox();

    // A stretched, left-aligned link would be as wide as the card.
    expect(privacy!.width, path).toBeLessThan(card!.width / 2);
    expect(
      Math.abs(privacy!.x + privacy!.width / 2 - (card!.x + card!.width / 2)),
      path,
    ).toBeLessThan(2);
  }
});

test('guests only get the language switch and the login/register buttons', async ({ page }) => {
  const nav = new GuestNav(page);

  await page.goto('/privacy');
  await expect(nav.login).toBeVisible();
  await expect(nav.register).toBeVisible();
  await expect(nav.language).toBeVisible();
  await expect(nav.search).toHaveCount(0);

  // Each auth page only links to the other one.
  await nav.register.click();
  await expect(page).toHaveURL(/\/register/);
  await expect(nav.login).toBeVisible();

  await nav.login.click();
  await expect(page).toHaveURL(/\/login/);
  await expect(nav.register).toBeVisible();
  await expect(nav.search).toHaveCount(0);
});

test('a logged-in user gets the search and the account menu', async ({ page, loggedIn }) => {
  await new TodosPage(page).goto();

  await expect(new GuestNav(page).search).toBeVisible();
  await expect(page.getByRole('button', { name: loggedIn.email })).toBeVisible();
  await expect(new GuestNav(page).register).toHaveCount(0);
});
