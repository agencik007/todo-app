import { newUser, registerUser, VERIFY_EMAIL_PATH } from '../fixtures/api';
import { waitForEmailLink } from '../fixtures/mailhog';
import { expect, test } from '../fixtures/test';
import { LoginPage, RegisterPage } from '../pages/auth.pages';
import { TodosPage } from '../pages/todos.page';

test('a new user registers, verifies the email, logs in and logs out', async ({
  page,
  request,
}) => {
  const user = newUser();
  const name = user.email.split('@')[0];

  await new RegisterPage(page).goto();
  await new RegisterPage(page).register(user);
  await expect(page).toHaveURL(/\/check-email/);

  const verifyPath = await waitForEmailLink(request, user.email, VERIFY_EMAIL_PATH);
  await page.goto(verifyPath);
  await expect(page).toHaveURL(/\/login\?verified=success/);

  await new LoginPage(page).login(user);
  await expect(page).toHaveURL(/\/todos/);
  await expect(new TodosPage(page).greeting(name)).toBeVisible();

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
  await expect(todos.greeting(loggedIn.email.split('@')[0])).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/\/todos/);
  await expect(todos.greeting(loggedIn.email.split('@')[0])).toBeVisible();
});
