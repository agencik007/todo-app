import { createTodoViaApi } from '../fixtures/api';
import { expect, test } from '../fixtures/test';
import { TodosPage } from '../pages/todos.page';

/** `YYYY-MM-DD` of the local day `offset` days from today (local getters, as the app does). */
function localDate(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

test.describe('due dates', () => {
  test.beforeEach(async ({ page, loggedIn }) => {
    void loggedIn;
    const todos = new TodosPage(page);
    await todos.goto();
    await expect(todos.greeting()).toBeVisible();
  });

  test('adds a due date and time with quick picks', async ({ page }) => {
    const todos = new TodosPage(page);
    await todos.add('Pay rent');
    await todos.setDue('Pay rent', { date: 'Tomorrow', time: 'Afternoon' });
    await expect(todos.dueChip('Pay rent')).toHaveText('Tomorrow, 2:00 PM');

    await page.reload();
    await expect(todos.dueChip('Pay rent')).toHaveText('Tomorrow, 2:00 PM');
  });

  test('clearing the date removes the chip', async ({ page, user, request }) => {
    const todos = new TodosPage(page);
    await createTodoViaApi(request, user, {
      title: 'Dated task',
      dueDate: localDate(3),
      dueTime: '09:00',
    });
    await page.reload();
    await expect(todos.dueChip('Dated task')).toBeVisible();

    await todos.setDue('Dated task', { date: null });
    await expect(todos.dueChip('Dated task')).toBeHidden();

    await page.reload();
    await expect(todos.row('Dated task')).toBeVisible();
    await expect(todos.dueChip('Dated task')).toBeHidden();
  });

  test('marks overdue tasks but not completed ones', async ({ page, user, request }) => {
    test.skip(
      new Date().getHours() === 0 && new Date().getMinutes() < 5,
      'a task due at 00:00 is not yet overdue right after midnight',
    );
    const todos = new TodosPage(page);
    await createTodoViaApi(request, user, { title: 'Two days late', dueDate: localDate(-2) });
    await createTodoViaApi(request, user, {
      title: 'Due at midnight',
      dueDate: localDate(0),
      dueTime: '00:00',
    });
    await createTodoViaApi(request, user, {
      title: 'Done and late',
      dueDate: localDate(-2),
      completed: true,
    });
    await page.reload();

    await expect(todos.dueChip('Two days late')).toHaveClass(/is-overdue/);
    await expect(todos.dueChip('Due at midnight')).toHaveClass(/is-overdue/);
    await expect(todos.dueChip('Done and late')).toBeVisible();
    await expect(todos.dueChip('Done and late')).not.toHaveClass(/is-overdue/);
  });
});

test.describe('east of UTC', () => {
  test.use({ timezoneId: 'Pacific/Auckland' });

  test('quick picks keep the local day east of UTC', async ({ page, loggedIn }) => {
    void loggedIn;
    // Pin the clock (timers keep running) to 20:00 UTC of the previous day, when
    // Auckland (UTC+12/+13) is already on the next calendar day. Without that, a
    // UTC-based "today" in the app would only differ for part of the real day.
    // A past instant keeps the server-issued access token valid.
    const instant = new Date();
    instant.setUTCDate(instant.getUTCDate() - 1);
    instant.setUTCHours(20, 0, 0, 0);
    const aucklandDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Pacific/Auckland',
    }).format(instant);
    expect(aucklandDate).not.toBe(instant.toISOString().slice(0, 10));
    await page.clock.install({ time: instant });

    const todos = new TodosPage(page);
    await todos.goto();
    await expect(todos.greeting()).toBeVisible();

    await todos.add('Due today', { due: { date: 'Today' } });
    await todos.add('Due tomorrow', { due: { date: 'Tomorrow' } });
    await expect(todos.dueChip('Due today')).toHaveText('Today');
    await expect(todos.dueChip('Due tomorrow')).toHaveText('Tomorrow');

    await page.reload();
    await expect(todos.dueChip('Due today')).toHaveText('Today');
    await expect(todos.dueChip('Due tomorrow')).toHaveText('Tomorrow');
  });
});
