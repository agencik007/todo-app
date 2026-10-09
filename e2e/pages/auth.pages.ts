import { Locator, Page } from '@playwright/test';

import { TestUser } from '../fixtures/api';

export class LoginPage {
  readonly heading: Locator;
  readonly error: Locator;

  constructor(readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Login' });
    // The inline form message; the same text also appears in a toast outside <main>.
    this.error = page.getByRole('main').getByRole('alert');
  }

  async goto(): Promise<void> {
    await this.page.goto('/login');
  }

  async login({ email, password }: TestUser): Promise<void> {
    await this.page.getByLabel('E-mail').fill(email);
    await this.page.getByLabel('Password', { exact: true }).fill(password);
    await this.page.getByRole('button', { name: 'Login', exact: true }).click();
  }
}

export class RegisterPage {
  constructor(readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/register');
  }

  async register({ email, password }: TestUser): Promise<void> {
    await this.page.getByLabel('E-mail').fill(email);
    await this.page.getByLabel('Password', { exact: true }).fill(password);
    await this.page.getByLabel('Confirm password').fill(password);
    await this.page.getByRole('button', { name: 'Register', exact: true }).click();
  }
}

export class UserMenu {
  constructor(readonly page: Page) {}

  async open(email: string): Promise<void> {
    await this.page.getByRole('button', { name: email }).click();
  }

  async deleteAccount({ email, password }: TestUser): Promise<void> {
    await this.open(email);
    await this.page.getByRole('button', { name: 'Delete account' }).click();
    const dialog = this.page.getByRole('dialog', { name: 'Delete account' });
    await dialog.getByLabel('Confirm with your password').fill(password);
    await dialog.getByRole('button', { name: 'Delete permanently' }).click();
  }
}
