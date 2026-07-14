import type { Meta, StoryObj } from '@storybook/angular-vite';
import { moduleMetadata } from '@storybook/angular-vite';
import { IconButtonDirective } from './icon-button.directive';

const meta: Meta<IconButtonDirective> = {
    title: 'Design System/IconButton',
    component: IconButtonDirective,
    decorators: [moduleMetadata({ imports: [IconButtonDirective] })],
    tags: ['autodocs'],
    argTypes: {
        variant: {
            control: 'select',
            options: ['ghost', 'primary', 'danger'],
        },
        size: {
            control: 'select',
            options: ['sm', 'md', 'lg', 'xl'],
        },
        reveal: { control: 'boolean' },
    },
    args: {
        variant: 'ghost',
        size: 'md',
        reveal: false,
    },
};

export default meta;
type Story = StoryObj<IconButtonDirective>;

export const Playground: Story = {
    render: (args) => ({
        props: args,
        template: `
            <button
                appIconButton
                [variant]="variant"
                [size]="size"
                [reveal]="reveal"
                aria-label="Edytuj"
            >
                <i class="pi pi-pencil" aria-hidden="true"></i>
            </button>
        `,
    }),
};

export const WariantyIRozmiary: Story = {
    name: 'Warianty × rozmiary',
    render: () => ({
        template: `
            <div style="display: flex; flex-direction: column; gap: var(--app-space-3);">
                @for (variant of ['ghost', 'primary', 'danger']; track variant) {
                    <div style="display: flex; align-items: center; gap: var(--app-space-3);">
                        <code style="width: 5rem; font-size: var(--app-text-xs); color: var(--p-text-muted-color);">{{ variant }}</code>
                        @for (size of ['sm', 'md', 'lg', 'xl']; track size) {
                            <button appIconButton [variant]="variant" [size]="size" [attr.aria-label]="variant + ' ' + size">
                                <i class="pi pi-pencil" aria-hidden="true"></i>
                            </button>
                        }
                    </div>
                }
            </div>
        `,
    }),
};

export const RevealNaHoverKontenera: Story = {
    name: 'Reveal na hover kontenera',
    render: () => ({
        template: `
            <div
                class="reveal-demo"
                style="display: flex; align-items: center; gap: var(--app-space-2); max-width: 20rem; padding: var(--app-space-2) var(--app-space-3); border: 1px solid var(--p-content-border-color); border-radius: var(--app-radius-md);"
            >
                <span style="flex: 1;">Najedź na wiersz…</span>
                <button appIconButton size="sm" reveal aria-label="Edytuj">
                    <i class="pi pi-pencil" aria-hidden="true"></i>
                </button>
                <button appIconButton variant="danger" size="sm" reveal aria-label="Usuń">
                    <i class="pi pi-trash" aria-hidden="true"></i>
                </button>
            </div>
        `,
        styles: ['.reveal-demo:hover .app-icon-btn--reveal { opacity: 1; }'],
    }),
};
