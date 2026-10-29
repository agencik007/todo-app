import { Locator, Page } from '@playwright/test';

/** The first-login starter group picker at `/welcome`. */
export class WelcomePage {
  readonly root: Locator;
  readonly heading: Locator;
  /** Toggle tiles; `aria-pressed="true"` when selected. */
  readonly selectedTiles: Locator;
  readonly submit: Locator;
  readonly skip: Locator;

  constructor(readonly page: Page) {
    this.root = page.locator('app-welcome');
    this.heading = this.root.getByRole('heading', {
      level: 1,
      name: /Cześć! Od czego zaczniemy\?|Hi! Where do we start\?/,
    });
    this.selectedTiles = this.root.getByRole('button', { pressed: true });
    // The name starts with the arrow icon's glyph.
    this.submit = this.root.getByRole('button', { name: /(Zaczynamy|Let's go) \(\d+\)$/ });
    this.skip = this.root.getByRole('button', { name: /^(Pomiń|Skip)$/ });
  }

  async goto(): Promise<void> {
    await this.page.goto('/welcome');
  }

  /** A catalogue tile by its name in the user's language, e.g. `Zdrowie`. */
  tile(name: string): Locator {
    return this.root.getByRole('button', { name, exact: true });
  }
}
