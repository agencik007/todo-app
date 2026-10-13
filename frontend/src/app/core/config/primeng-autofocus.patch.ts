import { AutoFocus } from 'primeng/autofocus';

/**
 * Works around a PrimeNG 21 bug: `p-button` binds `[pAutoFocus]="autofocus ||
 * buttonProps?.autofocus"`, which is `undefined` for every button without
 * `buttonProps`, and `AutoFocus` only strips the native `autofocus` attribute
 * when the value is exactly `false`. Every `p-button` therefore rendered
 * `autofocus="true"`, so the browser focused the first enabled one on page
 * load and scrolled to it (the privacy policy opened at its Back button with
 * the title scrolled out of view).
 *
 * Runs on the server too, so the attribute never reaches prerendered HTML.
 */
export function patchPrimeNgAutofocus(): void {
  const original = AutoFocus.prototype.onAfterContentChecked;
  AutoFocus.prototype.onAfterContentChecked = function (this: AutoFocus): void {
    this.autofocus = !!this.autofocus;
    original.call(this);
  };
}
