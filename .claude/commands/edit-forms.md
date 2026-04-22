# edit-forms

Edytuj globalnie wszystkie formularze użytkownika w projekcie zgodnie z Angular Style Guide i Signal Forms API (experimental, Angular 21+).

---

## Formularze w projekcie

| Nazwa | HTML | TS/Component |
|-------|------|--------------|
| Login | `frontend/src/app/features/auth/components/login/login.html` | `login/login.ts` |
| Register | `frontend/src/app/features/auth/components/register/register.html` | `register/register.ts` |
| Forgot Password | `frontend/src/app/features/auth/components/forgot-password/forgot-password.html` | `forgot-password/forgot-password.ts` |
| Reset Password | `frontend/src/app/features/auth/components/reset-password/reset-password.html` | `reset-password/reset-password.ts` |
| Todo Form | `frontend/src/app/features/todos/components/todo-form/todo-form.html` | `todo-form/todo-form.ts` |
| Group Form | `frontend/src/app/features/groups/components/group-form/group-form.html` | `group-form/group-form.component.ts` |

---

## Angular Style Guide — obowiązujące zasady

### Nazewnictwo i struktura plików
- Pliki nazywaj z myślnikami: `login-form.component.ts`, `todo-form.component.ts`
- Organizuj pliki według feature, nie według typu (nie `/components` na root)
- Selektory komponentów z prefiksem aplikacji (np. `app-login`, `app-todo-form`)

### Struktura komponentu (TypeScript)
- Używaj `inject()` zamiast constructor injection
- Właściwości Angular (`@Input`, `@Output`, signals) umieszczaj na górze klasy, przed metodami
- Używaj `protected` dla właściwości dostępnych tylko w szablonie
- Używaj `readonly` dla wartości inicjalizowanych przez Angular
- Implementuj interfejsy lifecycle hooks (`OnInit`, `OnDestroy`) dla type safety

### Szablony HTML
- **Nie używaj** `NgClass` ani `NgStyle` — zamiast tego natywne `[class.nazwa]` i `[style.prop]`
- Nazwy event handlerów opisowe: `onSubmit()`, `onEmailChange()`, nie `handleClick()`
- Unikaj logiki w szablonach — deleguj do metod/computed signals
- Używaj `@if`, `@for`, `@switch` (nowa składnia) zamiast `*ngIf`, `*ngFor`

---

## Signal Forms API (experimental, Angular 21+)

### Instalacja / importy
```typescript
import { form, schema, formRoot, FormField } from '@angular/forms/signals';
import { required, email, minLength, maxLength, min, max, pattern } from '@angular/forms/signals';
import { validate, validateAsync, validateTree } from '@angular/forms/signals';
import { disabled, hidden, readonly, debounce } from '@angular/forms/signals';
import { apply, applyEach, applyWhen, applyWhenValue } from '@angular/forms/signals';
```

### Tworzenie formularza
```typescript
// Definiuj sygnał z wartościami
readonly formData = signal({ email: '', password: '' });

// Utwórz Signal Form powiązany z sygnałem
readonly loginForm = form(this.formData, {
  email: [required(), email()],
  password: [required(), minLength(8)],
});
```

### Schema (wielokrotnego użytku)
```typescript
const authSchema = schema({
  email: [required({ message: 'Email jest wymagany' }), email()],
  password: [required(), minLength(8, { message: 'Min. 8 znaków' })],
});
```

### Szablon HTML
```html
<form [formRoot]="loginForm" (ngSubmit)="onSubmit()">
  <input type="email" [formField]="loginForm.email" />
  @if (loginForm.email.invalid() && loginForm.email.touched()) {
    <span>{{ loginForm.email.errors() | json }}</span>
  }
  <button type="submit" [disabled]="loginForm.invalid()">Zaloguj</button>
</form>
```

### Stan pola (signals, odczyt przez `()`)
- `field.valid()` / `field.invalid()`
- `field.touched()` / `field.untouched()`
- `field.dirty()` / `field.pristine()`
- `field.disabled()` / `field.enabled()`
- `field.pending()` — trwa walidacja async
- `field.errors()` — obiekt błędów
- `field.value()` / `field.value.set(val)` — odczyt i zapis wartości

### Różnice vs ReactiveFormsModule
| Reactive Forms | Signal Forms |
|---|---|
| `formControl`, `formControlName` | jeden dyrektywa `[formField]` |
| RxJS Observables | Angular Signals |
| `.get('field')` + casting | pełne type-safe dot notation |
| `ControlValueAccessor` | prosty interfejs `FormValueControl<T>` |
| `updateValueAndValidity()` | automatyczne dependency tracking |

### Migracja stopniowa
```typescript
import { compatForm } from '@angular/forms/signals';
// Łączy Signal Form z istniejącymi Reactive Forms
```

---

## Zadanie do wykonania

Użytkownik przekazał: **$ARGUMENTS**

### Kroki:
1. Przeczytaj wszystkie 6 plików HTML i ich odpowiedniki TS
2. Sprawdź aktualnie używany system formularzy (ReactiveFormsModule / Signal Forms)
3. Zidentyfikuj formularze wymagające zmiany (domyślnie: wszystkie)
4. Wprowadź spójne zmiany we wszystkich wybranych formularzach, przestrzegając:
   - Angular Style Guide (patrz wyżej)
   - Signal Forms API jeśli zadanie tego dotyczy
5. Po edycji podsumuj: co zmieniłeś i w których plikach

Jeśli `$ARGUMENTS` jest puste — wylistuj aktualną strukturę wszystkich 6 formularzy:
pola, walidatory, klasy CSS, używany system formularzy (Reactive / Signal).
