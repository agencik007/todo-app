import { completeOnboardingViaApi, groupsViaApi, loginViaApi } from '../fixtures/api';
import { expect, test } from '../fixtures/test';
import { sidebarGroups, TodoForm, TodosPage } from '../pages/todos.page';

/**
 * Group suggestions in the create-todo form. The stack runs the real local
 * embedding model; the phrases come from `python -m scripts.eval_suggestions`
 * (cold scenario, groups Dom/Praca/Zakupy/Hobby) and score well clear of the
 * thresholds (T_HIGH 0.30, T_CATALOG 0.25). Paths the model can't reach on
 * demand are covered by the "(mocked)" tests.
 */

// The first suggestion after the stack starts also loads the model.
const SUGGESTION_TIMEOUT = 20_000;
const SUGGEST_URL = '**/todos/suggest-group';

// Polish, so the starter groups and the catalogue proposals get Polish names.
test.use({ language: 'pl', onboarded: false });

test.beforeEach(async ({ page, request, user }) => {
  await completeOnboardingViaApi(request, user, ['HOME', 'WORK', 'SHOPPING', 'HOBBY']);
  await loginViaApi(page.request, user);
  await new TodosPage(page).goto();
  await expect(page.getByRole('heading', { name: /^Witaj/ })).toBeVisible();
  await expect(sidebarGroups(page)).toHaveCount(4);
});

const EMPTY = /^\s*$/;

test('auto-fills a high-confidence group and undo clears it', async ({ page }) => {
  const form = new TodoForm(page);
  await form.open();

  // Zakupy scores 0.529 (T_HIGH 0.30).
  await form.title.fill('Lista zakupów na weekend');

  await expect(form.group).toHaveText('Zakupy', { timeout: SUGGESTION_TIMEOUT });
  await expect(form.aiHint).toContainText('Wybrane przez AI');

  await form.undo.click();
  await expect(form.group).toHaveText(EMPTY);
  await expect(form.aiHint).toBeHidden();
});

test('proposes a catalogue group and creates it', async ({ page }) => {
  const form = new TodoForm(page);
  await form.open();

  // Catalogue HEALTH scores 0.434; the best own group (Praca) only 0.185.
  await form.title.fill('Umówić wizytę u dentysty');

  await expect(form.newGroupChip).toContainText('Zdrowie', { timeout: SUGGESTION_TIMEOUT });
  await form.createAndAssign.click();

  await expect(form.group).toHaveText('Zdrowie');
  await expect(form.newGroupChip).toBeHidden();
  await expect(sidebarGroups(page).filter({ hasText: 'Zdrowie' })).toBeVisible();
});

test('manual choice is never overridden', async ({ page }) => {
  const form = new TodoForm(page);
  await form.open();
  await form.pickGroup('Praca');

  const suggestRequest = page.waitForRequest(SUGGEST_URL, { timeout: 2_000 }).catch(() => null);
  await form.title.fill('Kupić mleko');

  // A hand-picked group stops the suggestions: nothing is even asked for
  // within 4x the 500 ms debounce.
  expect(await suggestRequest).toBeNull();
  await expect(form.group).toHaveText('Praca');
  await expect(form.aiHint).toBeHidden();
});

test('no suggestion is asked for once the task is added', async ({ page }) => {
  const form = new TodoForm(page);
  const todos = new TodosPage(page);
  await form.open();

  const suggestRequest = page.waitForRequest(SUGGEST_URL, { timeout: 1_500 }).catch(() => null);
  await form.title.fill('Kupić mleko');
  await form.submit.click();

  // Add stops the suggestions: the debounce that runs out after the click
  // sends nothing.
  expect(await suggestRequest).toBeNull();
  await expect(form.dialog).toBeHidden();
  await expect(todos.row('Kupić mleko')).toBeVisible();
});

test('(mocked) a medium-confidence group is offered and "Use" selects it', async ({
  page,
  request,
  user,
}) => {
  const work = (await groupsViaApi(request, user)).find((group) => group.name === 'Praca')!;
  await page.route(SUGGEST_URL, (route) =>
    route.fulfill({
      json: { groupId: work.id, newGroup: null, confidence: 'medium', reason: 'Raport kwartalny' },
    }),
  );
  const form = new TodoForm(page);
  await form.open();

  await form.title.fill('Coś do zrobienia');

  await expect(form.chip).toContainText('Praca', { timeout: SUGGESTION_TIMEOUT });
  // Medium confidence only offers the group, it doesn't fill it in.
  await expect(form.group).toHaveText(EMPTY);

  await form.use.click();
  await expect(form.group).toHaveText('Praca');
  await expect(form.chip).toBeHidden();
  await expect(form.aiHint).toBeHidden();
});

test('(mocked) an unavailable service stays silent and the form still saves', async ({
  page,
}) => {
  await page.route(SUGGEST_URL, (route) =>
    route.fulfill({ status: 503, json: { detail: { messageCode: 'SUGGESTIONS_UNAVAILABLE' } } }),
  );
  const form = new TodoForm(page);
  const todos = new TodosPage(page);
  await form.open();

  const suggestResponse = page.waitForResponse(SUGGEST_URL);
  await form.title.fill('Lista zakupów na weekend');
  expect((await suggestResponse).status()).toBe(503);

  await expect(form.aiHint).toBeHidden();
  await expect(form.chip).toBeHidden();
  await expect(form.newGroupChip).toBeHidden();
  await expect(form.group).toHaveText(EMPTY);
  await expect(page.locator('.p-toast-message-error')).toHaveCount(0);

  await form.submit.click();
  await expect(form.dialog).toBeHidden();
  await expect(todos.row('Lista zakupów na weekend')).toBeVisible();
  await expect(page.locator('.p-toast-message-error')).toHaveCount(0);
});
