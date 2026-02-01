import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';

export const routes: Routes = [
    {
        path: '',
        redirectTo: '/todos',
        pathMatch: 'full',
    },
    {
        path: 'login',
        loadComponent: () => import('./features/auth/components/login/login').then((m) => m.LoginComponent),
        canActivate: [guestGuard],
    },
    {
        path: 'register',
        loadComponent: () => import('./features/auth/components/register/register').then((m) => m.RegisterComponent),
        canActivate: [guestGuard],
    },
    {
        path: 'check-email',
        loadComponent: () =>
            import('./features/auth/components/check-email/check-email').then((m) => m.CheckEmailComponent),
    },
    {
        path: 'forgot-password',
        loadComponent: () =>
            import('./features/auth/components/forgot-password/forgot-password').then((m) => m.ForgotPasswordComponent),
        canActivate: [guestGuard],
    },
    {
        path: 'reset-password',
        loadComponent: () =>
            import('./features/auth/components/reset-password/reset-password').then((m) => m.ResetPasswordComponent),
        canActivate: [guestGuard],
    },
    {
        path: 'reset-password/:token',
        loadComponent: () =>
            import('./features/auth/components/reset-password/reset-password').then((m) => m.ResetPasswordComponent),
        canActivate: [guestGuard],
    },
    {
        path: 'verify-email',
        loadComponent: () =>
            import('./features/auth/components/verify-email/verify-email').then((m) => m.VerifyEmailComponent),
    },
    {
        path: 'verify-email/:token',
        loadComponent: () =>
            import('./features/auth/components/verify-email/verify-email').then((m) => m.VerifyEmailComponent),
    },
    {
        path: 'todos',
        loadComponent: () => import('./features/todos/components/todo-list/todo-list').then((m) => m.TodoListComponent),
        canActivate: [authGuard],
    },
    {
        path: '**',
        redirectTo: '/todos',
    },
];
