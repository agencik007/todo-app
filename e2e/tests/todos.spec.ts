import { expect, test } from '../fixtures/test';
import { TodosPage } from '../pages/todos.page';

test.beforeEach(async ({ page, loggedIn }) => {
  void loggedIn;
  const todos = new TodosPage(page);
  await todos.goto();
  await expect(todos.greeting()).toBeVisible();
});

test('a new user starts with an empty list', async ({ page }) => {
  await expect(page.getByText('No tasks')).toBeVisible();
});

test('creates, edits, completes and deletes a task', async ({ page }) => {
  const todos = new TodosPage(page);

  await todos.add('Buy milk', 'Two litres');
  await expect(todos.row('Buy milk')).toContainText('Two litres');

  await todos.rename('Buy milk', 'Buy oat milk');
  await expect(todos.row('Buy oat milk')).toBeVisible();
  await expect(todos.row('Buy milk ')).toHaveCount(0);

  await todos.toggle('Buy oat milk');
  await expect(todos.filter('Completed')).toContainText('1');

  await todos.remove('Buy oat milk');
  await expect(todos.row('Buy oat milk')).toHaveCount(0);
  await expect(page.getByText('No tasks')).toBeVisible();
});

test('tasks persist after a reload', async ({ page }) => {
  const todos = new TodosPage(page);
  await todos.add('Persisted task');

  await page.reload();
  await expect(todos.row('Persisted task')).toBeVisible();
});

test('status filters show pending and completed tasks separately', async ({ page }) => {
  const todos = new TodosPage(page);
  await todos.add('Pending task');
  await todos.add('Done task');
  await todos.toggle('Done task');
  await expect(todos.filter('Completed')).toContainText('1');

  await todos.filter('To do').click();
  await expect(todos.row('Pending task')).toBeVisible();
  await expect(todos.row('Done task')).toHaveCount(0);

  await todos.filter('Completed').click();
  await expect(todos.row('Done task')).toBeVisible();
  await expect(todos.row('Pending task')).toHaveCount(0);

  await todos.filter('All').click();
  await expect(todos.row('Pending task')).toBeVisible();
  await expect(todos.row('Done task')).toBeVisible();
});

test('closing the form gives focus back to the button that opened it', async ({ page }) => {
  const todos = new TodosPage(page);
  await todos.add('Focus task');
  await expect(todos.addButton()).toBeFocused();

  const edit = todos.row('Focus task').getByRole('button', { name: 'Edit task' });
  await edit.focus();
  await page.keyboard.press('Enter');
  await expect(todos.dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(todos.dialog).toBeHidden();
  await expect(edit).toBeFocused();
});
