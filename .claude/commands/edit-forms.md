# edit-forms

Globally edit all user forms in the project according to the Angular Style Guide and Signal Forms API (experimental, Angular 21+).

---

## Forms in the project

| Name | HTML | TS/Component |
|------|------|--------------|
| Login | `frontend/src/app/features/auth/components/login/login.html` | `login/login.ts` |
| Register | `frontend/src/app/features/auth/components/register/register.html` | `register/register.ts` |
| Forgot Password | `frontend/src/app/features/auth/components/forgot-password/forgot-password.html` | `forgot-password/forgot-password.ts` |
| Reset Password | `frontend/src/app/features/auth/components/reset-password/reset-password.html` | `reset-password/reset-password.ts` |
| Todo Form | `frontend/src/app/features/todos/components/todo-form/todo-form.html` | `todo-form/todo-form.ts` |
| Group Form | `frontend/src/app/features/groups/components/group-form/group-form.html` | `group-form/group-form.component.ts` |

---

## Angular Style Guide — applicable rules

### File naming and structure
- Name files with dashes: `login-form.component.ts`, `todo-form.component.ts`
- Organize files by feature, not by type (no `/components` at root)
- Component selectors with application prefix (e.g. `app-login`, `app-todo-form`)

### Component structure (TypeScript)
- Use `inject()` instead of constructor injection
- Place Angular properties (`@Input`, `@Output`, signals) at the top of the class, before methods
- Use `protected` for properties only accessible in the template
- Use `readonly` for values initialized by Angular
- Implement lifecycle hook interfaces (`OnInit`, `OnDestroy`) for type safety

### HTML templates
- **Do not use** `NgClass` or `NgStyle` — use native `[class.name]` and `[style.prop]` instead
- Event handler names should be descriptive: `onSubmit()`, `onEmailChange()`, not `handleClick()`
- Avoid logic in templates — delegate to methods/computed signals
- Use `@if`, `@for`, `@switch` (new syntax) instead of `*ngIf`, `*ngFor`

---

## Signal Forms API (experimental, Angular 21+)

### Installation / imports
```typescript
import { form, schema, formRoot, FormField } from '@angular/forms/signals';
import { required, email, minLength, maxLength, min, max, pattern } from '@angular/forms/signals';
import { validate, validateAsync, validateTree } from '@angular/forms/signals';
import { disabled, hidden, readonly, debounce } from '@angular/forms/signals';
import { apply, applyEach, applyWhen, applyWhenValue } from '@angular/forms/signals';
```

### Creating a form
```typescript
// Define a signal with values
readonly formData = signal({ email: '', password: '' });

// Create a Signal Form bound to the signal
readonly loginForm = form(this.formData, {
  email: [required(), email()],
  password: [required(), minLength(8)],
});
```

### Schema (reusable)
```typescript
const authSchema = schema({
  email: [required({ message: 'Email is required' }), email()],
  password: [required(), minLength(8, { message: 'Min. 8 characters' })],
});
```

### HTML template
```html
<form [formRoot]="loginForm" (ngSubmit)="onSubmit()">
  <input type="email" [formField]="loginForm.email" />
  @if (loginForm.email.invalid() && loginForm.email.touched()) {
    <span>{{ loginForm.email.errors() | json }}</span>
  }
  <button type="submit" [disabled]="loginForm.invalid()">Login</button>
</form>
```

### Field state (signals, read via `()`)
- `field.valid()` / `field.invalid()`
- `field.touched()` / `field.untouched()`
- `field.dirty()` / `field.pristine()`
- `field.disabled()` / `field.enabled()`
- `field.pending()` — async validation in progress
- `field.errors()` — errors object
- `field.value()` / `field.value.set(val)` — read and write value

### Differences vs ReactiveFormsModule
| Reactive Forms | Signal Forms |
|---|---|
| `formControl`, `formControlName` | single `[formField]` directive |
| RxJS Observables | Angular Signals |
| `.get('field')` + casting | fully type-safe dot notation |
| `ControlValueAccessor` | simple `FormValueControl<T>` interface |
| `updateValueAndValidity()` | automatic dependency tracking |

### Gradual migration
```typescript
import { compatForm } from '@angular/forms/signals';
// Bridges Signal Form with existing Reactive Forms
```

---

## Task

The user provided: **$ARGUMENTS**

### Steps:
1. Read all 6 HTML files and their corresponding TS counterparts
2. Check the currently used form system (ReactiveFormsModule / Signal Forms)
3. Identify forms that need changes (default: all)
4. Apply consistent changes across all selected forms, following:
   - Angular Style Guide (see above)
   - Signal Forms API if the task requires it
5. After editing, summarize: what you changed and in which files

If `$ARGUMENTS` is empty — list the current structure of all 6 forms:
fields, validators, CSS classes, form system in use (Reactive / Signal).
