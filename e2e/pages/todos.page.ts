import { expect, Locator, Page } from '@playwright/test';

export class TodosPage {
  readonly dialog: Locator;

  constructor(readonly page: Page) {
    this.dialog = page.getByRole('dialog');
  }

  async goto(): Promise<void> {
    await this.page.goto('/todos');
  }

  greeting(): Locator {
    return this.page.getByRole('heading', { name: /^Hello/ });
  }

  row(title: string): Locator {
    return this.page.getByRole('listitem').filter({ hasText: title });
  }

  /** The floating "Add task" button. */
  addButton(): Locator {
    return this.page.getByRole('button', { name: 'Add task' }).last();
  }

  filter(name: 'All' | 'To do' | 'Completed'): Locator {
    // Accessible name is the label plus the count, e.g. "To do 3".
    return this.page.getByRole('button', { name: new RegExp(`^${name} \\d+$`) });
  }

  async add(title: string, description?: string): Promise<void> {
    await this.page.getByRole('button', { name: 'Add task' }).click();
    await this.dialog.getByRole('textbox', { name: /^Title/ }).fill(title);
    if (description) {
      await this.dialog.getByRole('textbox', { name: 'Description' }).fill(description);
    }
    await this.dialog.getByRole('button', { name: 'Add task' }).click();
    await expect(this.dialog).toBeHidden();
  }

  async rename(title: string, newTitle: string): Promise<void> {
    const row = this.row(title);
    await row.hover();
    await row.getByRole('button', { name: 'Edit task' }).click();
    await this.dialog.getByRole('textbox', { name: /^Title/ }).fill(newTitle);
    await this.dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(this.dialog).toBeHidden();
  }

  async toggle(title: string): Promise<void> {
    const checkbox = this.row(title).getByRole('checkbox');
    const wasChecked = await checkbox.isChecked();
    await checkbox.click();
    await expect(checkbox).toBeChecked({ checked: !wasChecked });
  }

  async remove(title: string): Promise<void> {
    const row = this.row(title);
    await row.hover();
    await row.getByRole('button', { name: 'Delete task' }).click();
    await this.page.getByRole('alertdialog').getByRole('button', { name: 'Yes, delete' }).click();
  }
}

/** The group list in the sidebar. */
export function sidebarGroups(page: Page): Locator {
  return page.getByRole('menu', { name: 'Task groups' }).locator('.group-name');
}

/**
 * The create-todo dialog with its AI group suggestions. Labels match both
 * languages, as the suggestion specs run with a Polish account.
 */
export class TodoForm {
  readonly dialog: Locator;
  readonly title: Locator;
  /** The group select; its text is the selected group's name. */
  readonly group: Locator;
  readonly aiHint: Locator;
  readonly undo: Locator;
  /** Medium confidence: one of the user's groups, with "Use". */
  readonly chip: Locator;
  readonly use: Locator;
  /** A catalogue group the user doesn't have yet. */
  readonly newGroupChip: Locator;
  readonly createAndAssign: Locator;
  readonly submit: Locator;

  constructor(readonly page: Page) {
    this.dialog = page.getByRole('dialog');
    this.title = this.dialog.getByRole('textbox', { name: /^(Tytuł|Title)/ });
    this.group = this.dialog.locator('#group');
    this.aiHint = this.dialog.getByTestId('ai-group-hint');
    this.undo = this.aiHint.getByRole('button', { name: /^(Cofnij|Undo)$/ });
    this.chip = this.dialog.getByTestId('ai-group-chip');
    this.use = this.chip.getByRole('button', { name: /^(Użyj|Use)$/ });
    this.newGroupChip = this.dialog.getByTestId('ai-new-group-chip');
    this.createAndAssign = this.newGroupChip.getByRole('button', {
      name: /^(Utwórz i przypisz|Create and assign)$/,
    });
    this.submit = this.dialog.getByRole('button', { name: /(Dodaj zadanie|Add task)$/ });
  }

  async open(): Promise<void> {
    await this.page
      .getByRole('button', { name: /(Dodaj zadanie|Add task)$/ })
      .first()
      .click();
    await expect(this.dialog).toBeVisible();
  }

  /** Picks a group by hand from the select. */
  async pickGroup(name: string): Promise<void> {
    await this.group.click();
    await this.page.getByRole('option', { name, exact: true }).click();
  }
}
