import { expect, test } from '../fixtures/test';
import { UserMenu } from '../pages/auth.pages';
import { TodosPage } from '../pages/todos.page';

// Runs in the default `chromium` project, where service workers are blocked.

test.describe('task reminders', () => {
  test.beforeEach(async ({ page, loggedIn }) => {
    void loggedIn;
    const todos = new TodosPage(page);
    await todos.goto();
    await expect(todos.greeting()).toBeVisible();
  });

  test('sets a reminder and shows the bell', async ({ page }) => {
    const todos = new TodosPage(page);
    await todos.add('Call the dentist', {
      due: { date: 'Tomorrow', time: 'Afternoon' },
      reminder: '15 minutes before',
    });
    await expect(todos.reminderBell('Call the dentist')).toBeVisible();
    await expect(todos.row('Call the dentist')).toContainText('Reminder: 15 minutes before');

    await page.reload();
    await expect(todos.reminderBell('Call the dentist')).toBeVisible();
  });

  test('a task without a reminder has no bell', async ({ page }) => {
    const todos = new TodosPage(page);
    await todos.add('No reminder here', { due: { date: 'Tomorrow' } });
    await expect(todos.dueChip('No reminder here')).toBeVisible();
    await expect(todos.reminderBell('No reminder here')).toBeHidden();
  });

  test('reminder options follow the time', async ({ page }) => {
    const todos = new TodosPage(page);
    await page.getByRole('button', { name: 'Add task' }).click();
    await todos.dialog.getByRole('textbox', { name: /^Title/ }).fill('Options task');
    await expect(todos.reminderSelect()).toBeHidden();

    await todos.dialog.getByRole('button', { name: 'Tomorrow', exact: true }).click();
    expect(await todos.reminderOptions()).toEqual([
      'No reminder',
      'On the day at 9:00',
      'The day before at 9:00',
    ]);

    await todos.dialog.getByRole('button', { name: 'Afternoon', exact: true }).click();
    expect(await todos.reminderOptions()).toEqual([
      'No reminder',
      'At the time',
      '15 minutes before',
      '1 hour before',
      '1 day before',
    ]);

    await todos.pickReminder('15 minutes before');
    await expect(todos.reminderSelect()).toContainText('15 minutes before');

    // Clearing the time falls back to the date-only equivalent.
    await todos.clearDueTime();
    await expect(todos.reminderSelect()).toContainText('On the day at 9:00');
  });

  test('notifications setting is unsupported without the Notification API', async ({
    page,
    loggedIn,
  }) => {
    // Service workers are blocked in this project but the API still exists, so
    // the browser reports the permission as blocked. Remove the Notification API
    // (as in iOS Safari outside the installed app) to reach "unsupported".
    await page.addInitScript(() => {
      delete (window as { Notification?: unknown }).Notification;
    });
    await page.reload();
    await expect(page.getByRole('heading', { name: /^Hello/ })).toBeVisible();
    await new UserMenu(page).openSettings(loggedIn.email);
    await expect(page.getByText("This browser can't show notifications here.")).toBeVisible();
    await expect(page.getByRole('switch', { name: 'Browser notifications' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Send a test notification' })).toBeHidden();
  });
});
