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

  /** Shown instead of the weather when location access is off. */
  setLocationButton(): Locator {
    return this.page.getByRole('button', { name: 'Set weather location' });
  }

  changeLocationButton(): Locator {
    return this.dialog.getByRole('button', { name: 'Change location' });
  }

  citySearch(): Locator {
    return this.dialog.getByRole('combobox', { name: 'Search for a city' });
  }

  async chooseCity(query: string, option: string): Promise<void> {
    await this.citySearch().fill(query);
    await this.page.getByRole('option', { name: option }).click();
  }

  useMyLocationButton(): Locator {
    return this.dialog.getByRole('button', { name: 'Use my location' });
  }

  title(): Locator {
    return this.dialog.locator('.p-dialog-title');
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
