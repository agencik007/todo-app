import { Tooltip } from 'primeng/tooltip';

/** Minimum gap between a tooltip and the viewport edge, in px. */
const VIEWPORT_MARGIN = 8;

/**
 * PrimeNG tries the four sides centred on the host and keeps the last one
 * even when none fits, so a wide tooltip near the screen edge (the weather
 * widget on a phone) ends up partly off-screen. When that happens, this
 * puts the tooltip above or below the host and slides it sideways into the
 * viewport, keeping the arrow on the host. Call once before bootstrap.
 */
export function keepTooltipsInViewport(): void {
  const align = Tooltip.prototype.align;

  Tooltip.prototype.align = function (this: Tooltip): void {
    align.call(this);
    if (!this.container || !this.isOutOfBounds()) return;

    const vertical =
      this.getOption('tooltipPosition') === 'top'
        ? [this.alignTop, this.alignBottom]
        : [this.alignBottom, this.alignTop];
    for (const alignFn of vertical) {
      alignFn.call(this);
      const { top, bottom } = this.container.getBoundingClientRect();
      if (top >= 0 && bottom <= window.innerHeight) break;
    }

    const container: HTMLElement = this.container;
    const { left, right, width } = container.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const shift = Math.max(
      VIEWPORT_MARGIN - left,
      Math.min(0, viewportWidth - VIEWPORT_MARGIN - right),
    );
    container.style.left = `${parseFloat(container.style.left) + shift}px`;

    const arrow: HTMLElement | null = this.getArrowElement();
    if (arrow) {
      const arrowLeft = width / 2 - shift;
      arrow.style.left = `${Math.min(Math.max(arrowLeft, VIEWPORT_MARGIN), width - VIEWPORT_MARGIN)}px`;
    }
  };
}
