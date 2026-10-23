import { Locator, Page } from '@playwright/test';

/** The header weather widget and its details dialog. */
export class WeatherPage {
  readonly widget: Locator;
  readonly dialog: Locator;

  constructor(readonly page: Page) {
    // Accessible name: the tooltip text plus "Show weather details".
    this.widget = page.getByRole('button', { name: /Show weather details$/ });
    this.dialog = page.getByRole('dialog');
  }

  hourlyItems(): Locator {
    return this.dialog.getByRole('list', { name: 'Next 24 hours' }).getByRole('listitem');
  }

  dailyItems(): Locator {
    return this.dialog
      .getByRole('region', { name: 'Next 7 days' })
      .getByRole('listitem');
  }

  detail(label: string): Locator {
    return this.dialog.getByRole('term').filter({ hasText: label }).locator('+ dd');
  }
}
