import type { Meta, StoryObj } from '@storybook/angular-vite';
import { moduleMetadata } from '@storybook/angular-vite';
import { ButtonModule } from 'primeng/button';
import { EmptyStateComponent } from './empty-state.component';

const meta: Meta<EmptyStateComponent> = {
    title: 'Design System/EmptyState',
    component: EmptyStateComponent,
    tags: ['autodocs'],
    argTypes: {
        tone: { control: 'select', options: ['neutral', 'primary', 'danger'] },
        size: { control: 'select', options: ['md', 'lg'] },
    },
    args: {
        icon: 'pi-filter-slash',
        heading: 'Brak wyników',
        description: 'Zmień filtry albo wyczyść wyszukiwanie.',
        tone: 'neutral',
        size: 'md',
    },
};

export default meta;
type Story = StoryObj<EmptyStateComponent>;

export const Playground: Story = {};

export const ZAkcja: Story = {
    name: 'Z akcją (projekcja)',
    decorators: [
        moduleMetadata({ imports: [EmptyStateComponent, ButtonModule] }),
    ],
    render: () => ({
        template: `
            <app-empty-state
                icon="pi-filter-slash"
                heading="Brak wyników"
                description="Zmień filtry albo wyczyść wyszukiwanie."
            >
                <p-button size="small" severity="secondary" [text]="true" icon="pi pi-times" label="Wyczyść filtry" />
            </app-empty-state>
        `,
    }),
};

export const EmojiZamiastIkony: Story = {
    name: 'Emoji zamiast ikony',
    args: {
        icon: undefined,
        emoji: '📝',
        heading: 'Nie masz jeszcze zadań',
        description: 'Dodaj pierwsze zadanie, aby zacząć.',
    },
};

export const StronaWynikowa: Story = {
    name: 'Strona wynikowa (size lg)',
    args: {
        icon: 'pi-check-circle',
        emoji: undefined,
        heading: 'E-mail zweryfikowany!',
        description: 'Za chwilę przekierujemy Cię do logowania.',
        tone: 'primary',
        size: 'lg',
    },
};

export const Blad: Story = {
    name: 'Błąd (tone danger)',
    args: {
        icon: 'pi-times-circle',
        emoji: undefined,
        heading: 'Weryfikacja nie powiodła się',
        description: 'Link wygasł lub jest nieprawidłowy.',
        tone: 'danger',
        size: 'lg',
    },
};
