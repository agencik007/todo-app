import { APIRequestContext, expect } from '@playwright/test';

import { urls } from './env';
import { waitForEmailLink } from './mailhog';

export interface TestUser {
  email: string;
  password: string;
}

export const VERIFY_EMAIL_PATH = /\/verify-email\/[\w-]+/;

/** A unique, valid user per call - tests never share accounts, so they can run in parallel. */
export function newUser(): TestUser {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return { email: `e2e-${id}@example.com`, password: `E2e-Pass-${id}!` };
}

export async function registerUser(request: APIRequestContext, user: TestUser): Promise<void> {
  const response = await request.post(`${urls.api}/auth/register`, { data: user });
  expect(response.status(), await response.text()).toBe(201);
}

/** Registers `user` and verifies the email through the link MailHog captured. */
export async function createVerifiedUser(
  request: APIRequestContext,
  user: TestUser = newUser(),
): Promise<TestUser> {
  await registerUser(request, user);
  const verifyPath = await waitForEmailLink(request, user.email, VERIFY_EMAIL_PATH);
  const token = verifyPath.split('/').pop();
  const response = await request.get(`${urls.api}/auth/verify-email/${token}`);
  expect(response.ok(), await response.text()).toBeTruthy();
  return user;
}

/**
 * Logs in through the API. Pass `page.request` so the HttpOnly refresh cookie
 * lands in the browser context; the app then restores the session on load.
 */
export async function loginViaApi(request: APIRequestContext, user: TestUser): Promise<void> {
  const response = await request.post(`${urls.api}/auth/login`, { data: user });
  expect(response.ok(), await response.text()).toBeTruthy();
}
