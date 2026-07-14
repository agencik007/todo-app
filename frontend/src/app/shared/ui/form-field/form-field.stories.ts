import type { Meta, StoryObj } from '@storybook/angular-vite';
import { moduleMetadata } from '@storybook/angular-vite';
import { InputTextModule } from 'primeng/inputtext';
import { FormFieldComponent } from './form-field.component';

const meta: Meta<FormFieldComponent> = {
    title: 'Design System/FormField',
    component: FormFieldComponent,
    decorators: [
        moduleMetadata({ imports: [FormFieldComponent, InputTextModule] }),
    ],
    tags: ['autodocs'],
    args: {
        label: 'Adres e-mail',
        icon: 'pi-envelope',
        inputId: 'email',
    },
};

export default meta;
type Story = StoryObj<FormFieldComponent>;

export const Playground: Story = {
    render: (args) => ({
        props: args,
        template: `
            <div style="max-width: 24rem;">
                <app-form-field [label]="label" [icon]="icon" [inputId]="inputId">
                    <input pInputText [id]="inputId" class="w-full" placeholder="jan@przyklad.pl" />
                </app-form-field>
            </div>
        `,
    }),
};

export const ZBledem: Story = {
    name: 'Z komunikatem błędu',
    render: () => ({
        template: `
            <div style="max-width: 24rem;">
                <app-form-field label="Adres e-mail" icon="pi-envelope" inputId="email-err">
                    <input pInputText id="email-err" class="w-full ng-invalid ng-dirty" value="niepoprawny" />
                    <small role="alert" class="p-error">Nieprawidłowy format adresu e-mail</small>
                </app-form-field>
            </div>
        `,
    }),
};

export const BezIkony: Story = {
    name: 'Bez ikony (formularz dialogowy)',
    render: () => ({
        template: `
            <div style="max-width: 24rem;">
                <app-form-field label="Nazwa grupy" inputId="group-name">
                    <input pInputText id="group-name" class="w-full" placeholder="np. Praca" />
                </app-form-field>
            </div>
        `,
    }),
};
