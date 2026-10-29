import { APIRequestContext, expect } from '@playwright/test';

import { urls } from './env';
import { waitForEmailLink } from './mailhog';

export interface TestUser {
  email: string;
  password: string;
  /** Interface language at sign-up; the app switches to it after login. Defaults to `en`. */
  language?: 'en' | 'pl';
}

export const VERIFY_EMAIL_PATH = /\/verify-email\/[\w-]+/;

/** A unique, valid user per call - tests never share accounts, so they can run in parallel. */
export function newUser(language?: TestUser['language']): TestUser {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return { email: `e2e-${id}@example.com`, password: `E2e-Pass-${id}!`, language };
}

export async function registerUser(request: APIRequestContext, user: TestUser): Promise<void> {
  const response = await request.post(`${urls.api}/auth/register`, { data: user });
  expect(response.status(), await response.text()).toBe(201);
}

/**
 * Registers `user` and verifies the email through the link MailHog captured.
 * The first-login onboarding is completed with no starter groups unless
 * `onboarded` is false; the app then sends the user to `/welcome`.
 */
export async function createVerifiedUser(
  request: APIRequestContext,
  user: TestUser = newUser(),
  { onboarded = true }: { onboarded?: boolean } = {},
): Promise<TestUser> {
  await registerUser(request, user);
  const verifyPath = await waitForEmailLink(request, user.email, VERIFY_EMAIL_PATH);
  const token = verifyPath.split('/').pop();
  const response = await request.get(`${urls.api}/auth/verify-email/${token}`);
  expect(response.ok(), await response.text()).toBeTruthy();
  if (onboarded) {
    await completeOnboardingViaApi(request, user);
  }
  return user;
}

/**
 * Logs in through the API. Pass `page.request` so the HttpOnly refresh cookie
 * lands in the browser context; the app then restores the session on load.
 */
export async function loginViaApi(request: APIRequestContext, user: TestUser): Promise<string> {
  const response = await request.post(`${urls.api}/auth/login`, {
    data: { email: user.email, password: user.password },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return (await response.json()).accessToken;
}

/** Finishes the first-login onboarding, creating the catalogue groups with these keys. */
export async function completeOnboardingViaApi(
  request: APIRequestContext,
  user: TestUser,
  groupKeys: string[] = [],
): Promise<void> {
  const token = await loginViaApi(request, user);
  const response = await request.post(`${urls.api}/users/me/onboarding`, {
    data: { groupKeys },
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
}

export interface ApiGroup {
  id: number;
  name: string;
}

/** The user's groups, read through the API. */
export async function groupsViaApi(request: APIRequestContext, user: TestUser): Promise<ApiGroup[]> {
  const token = await loginViaApi(request, user);
  const response = await request.get(`${urls.api}/groups`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}
