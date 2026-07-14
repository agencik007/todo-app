import type { Meta, StoryObj } from '@storybook/angular-vite';
import { moduleMetadata } from '@storybook/angular-vite';
import { BadgeComponent } from './badge.component';

const meta: Meta<BadgeComponent> = {
    title: 'Design System/Badge',
    component: BadgeComponent,
    tags: ['autodocs'],
    argTypes: {
        color: {
            control: 'select',
            options: [
                'blue',
                'green',
                'red',
                'yellow',
                'purple',
                'pink',
                'orange',
                'teal',
                'indigo',
                'gray',
            ],
        },
        size: { control: 'select', options: ['sm', 'md', 'lg'] },
    },
    args: {
        label: 'Projekt X',
        color: 'blue',
        size: 'md',
        clickable: false,
    },
};

export default meta;
type Story = StoryObj<BadgeComponent>;

export const Playground: Story = {};

export const WszystkieKolory: Story = {
    name: 'Wszystkie kolory',
    decorators: [moduleMetadata({ imports: [BadgeComponent] })],
    render: () => ({
        template: `
            <div style="display: flex; gap: var(--app-space-3); flex-wrap: wrap;">
                @for (c of ['blue', 'green', 'red', 'yellow', 'purple', 'pink', 'orange', 'teal', 'indigo', 'gray']; track c) {
                    <app-badge [label]="c" [color]="c" />
                }
            </div>
        `,
    }),
};

export const Rozmiary: Story = {
    decorators: [moduleMetadata({ imports: [BadgeComponent] })],
    render: () => ({
        template: `
            <div style="display: flex; gap: var(--app-space-4); align-items: center;">
                <app-badge label="sm" color="teal" size="sm" />
                <app-badge label="md" color="teal" size="md" />
                <app-badge label="lg" color="teal" size="lg" />
            </div>
        `,
    }),
};
