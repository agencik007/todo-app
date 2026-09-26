import { expect, Locator, Page } from '@playwright/test';

export class TodosPage {
  readonly dialog: Locator;

  constructor(readonly page: Page) {
    this.dialog = page.getByRole('dialog');
  }

  async goto(): Promise<void> {
    await this.page.goto('/todos');
  }

  greeting(name: string): Locator {
    return this.page.getByRole('heading', { name: `Hello ${name}` });
  }

  row(title: string): Locator {
    return this.page.getByRole('listitem').filter({ hasText: title });
  }

  filter(name: 'All' | 'To do' | 'Completed'): Locator {
    return this.page.getByRole('tab', { name });
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
    await row.getByRole('button', { name: 'Edit Task' }).click();
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
    await row.getByRole('button', { name: 'Delete Task' }).click();
    await this.page.getByRole('alertdialog').getByRole('button', { name: 'Yes, delete' }).click();
  }
}
