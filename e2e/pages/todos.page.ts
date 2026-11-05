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

  async add(
    title: string,
    {
      description,
      due,
      reminder,
    }: {
      description?: string;
      due?: { date: 'Today' | 'Tomorrow'; time?: 'Morning' | 'Afternoon' | 'Evening' };
      /** Label of a reminder option; needs a due date. */
      reminder?: string;
    } = {},
  ): Promise<void> {
    await this.page.getByRole('button', { name: 'Add task' }).click();
    await this.dialog.getByRole('textbox', { name: /^Title/ }).fill(title);
    if (description) {
      await this.dialog.getByRole('textbox', { name: 'Description' }).fill(description);
    }
    if (due) {
      await this.dialog.getByRole('button', { name: due.date, exact: true }).click();
      if (due.time) {
        await this.dialog.getByRole('button', { name: due.time, exact: true }).click();
      }
    }
    if (reminder) {
      await this.pickReminder(reminder);
    }
    await this.dialog.getByRole('button', { name: 'Add task' }).click();
    await expect(this.dialog).toBeHidden();
  }

  /** The dialog's Reminder select (shown once a due date is set). */
  reminderSelect(): Locator {
    return this.dialog.locator('#reminder');
  }

  /** Opens the Reminder select and returns its option labels. */
  async reminderOptions(): Promise<string[]> {
    await this.reminderSelect().click();
    const options = this.page.getByRole('option');
    await expect(options.first()).toBeVisible();
    const labels = await options.allTextContents();
    await this.page.keyboard.press('Escape');
    await expect(options.first()).toBeHidden();
    return labels.map((label) => label.trim());
  }

  /** The bell on a task's due chip, shown when the task has a reminder. */
  reminderBell(title: string): Locator {
    return this.dueChip(title).locator('.pi-bell');
  }

  /** Clears the due time in the open dialog (the date stays). */
  async clearDueTime(): Promise<void> {
    await this.dialog
      .locator('p-datepicker')
      .filter({ has: this.page.locator('#dueTime') })
      .locator('.p-datepicker-clear-icon')
      .click();
  }

  async pickReminder(label: string): Promise<void> {
    await this.reminderSelect().click();
    await this.page.getByRole('option', { name: label, exact: true }).click();
  }

  async rename(title: string, newTitle: string): Promise<void> {
    const row = this.row(title);
    await row.hover();
    await row.getByRole('button', { name: 'Edit task' }).click();
    await this.dialog.getByRole('textbox', { name: /^Title/ }).fill(newTitle);
    await this.dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(this.dialog).toBeHidden();
  }

  /** The due date chip in a task's row. */
  dueChip(title: string): Locator {
    return this.row(title).getByTestId('due-chip');
  }

  /**
   * Opens the edit dialog and sets the due date with the quick buttons, or
   * clears it with the date field's clear icon (it has no accessible name, so
   * it is found by PrimeNG's class inside the due date field), then saves.
   */
  async setDue(
    title: string,
    due: { date: 'Today' | 'Tomorrow' | null; time?: 'Morning' | 'Afternoon' | 'Evening' },
  ): Promise<void> {
    const row = this.row(title);
    await row.hover();
    await row.getByRole('button', { name: 'Edit task' }).click();
    if (due.date === null) {
      await this.dialog
        .locator('p-datepicker')
        .filter({ has: this.page.locator('#dueDate') })
        .locator('.p-datepicker-clear-icon')
        .click();
      await expect(this.dialog.getByRole('button', { name: 'Morning' })).toBeHidden();
    } else {
      await this.dialog.getByRole('button', { name: due.date, exact: true }).click();
      if (due.time) {
        await this.dialog.getByRole('button', { name: due.time, exact: true }).click();
      }
    }
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
