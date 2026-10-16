import { ElementRef, inject } from '@angular/core';

/**
 * Keeps what the user typed into a server-rendered form before hydration.
 *
 * Hydration reuses the prerendered inputs and then writes the form model into
 * them, so a model that starts empty wipes that text. Bootstrap waits for the
 * app initializers (POST /auth/refresh), which on a slow connection leaves the
 * form typeable for seconds before that happens.
 *
 * Call it in a field initializer, so it runs before the template is rendered.
 * While hydrating, the component's host element still holds the prerendered
 * inputs; when the component is created on the client it is empty, and
 * `initial` comes back unchanged. Each key is read from the input whose id
 * matches it.
 */
export function withPrerenderedInputValues<T extends Record<string, string>>(
  initial: T,
): T {
  const host: HTMLElement = inject(ElementRef).nativeElement;
  const values = { ...initial };
  for (const key of Object.keys(values) as (keyof T & string)[]) {
    const input = host.querySelector<HTMLInputElement>(`input#${key}`);
    if (input?.value) {
      values[key] = input.value as T[keyof T & string];
    }
  }
  return values;
}
