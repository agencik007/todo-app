import type { Meta, StoryObj } from '@storybook/angular-vite';

/**
 * Żywa próbka motywu. Jej wyrenderowanie bootstrapuje Angulara
 * z providePrimeNG, co wstrzykuje zmienne --p-* do dokumentu —
 * dzięki temu swatche na stronie „Tokeny" mają skąd brać kolory.
 */
const meta: Meta = {
    title: 'Design System/Tokeny',
    parameters: {
        docs: { canvas: { sourceState: 'none' } },
    },
};

export default meta;
type Story = StoryObj;

export const Probka: Story = {
    name: 'Próbka motywu',
    render: () => ({
        template: `
            <div style="display: flex; flex-direction: column; gap: var(--app-space-3); font-family: var(--app-font-mono); color: var(--p-text-color);">
                <div style="display: flex; gap: var(--app-space-2); align-items: center;">
                    <span style="width: 2rem; height: 2rem; border-radius: var(--app-radius-md); background: var(--p-primary-500);"></span>
                    <span style="width: 2rem; height: 2rem; border-radius: var(--app-radius-md); background: var(--p-primary-300);"></span>
                    <span style="width: 2rem; height: 2rem; border-radius: var(--app-radius-md); background: var(--p-primary-100);"></span>
                    <code>--p-primary-*</code>
                </div>
                <div style="padding: var(--app-space-4); border-radius: var(--app-radius-lg); background: var(--p-content-background); border: 1px solid var(--p-content-border-color); box-shadow: var(--app-shadow-md); max-width: 24rem;">
                    <strong style="font-weight: var(--app-font-semibold);">Panel na tokenach</strong>
                    <p style="margin: var(--app-space-1) 0 0; font-size: var(--app-text-sm); color: var(--p-text-muted-color);">
                        Przełącz motyw i paletę w toolbarze — wszystko reaguje.
                    </p>
                </div>
            </div>
        `,
    }),
};
