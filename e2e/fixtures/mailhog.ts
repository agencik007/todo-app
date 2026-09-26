import { APIRequestContext, expect } from '@playwright/test';

import { urls } from './env';

interface MailhogPart {
  Headers: Record<string, string[]>;
  Body: string;
}

interface MailhogMessage {
  Content: MailhogPart;
  MIME: { Parts: MailhogPart[] } | null;
}

/** Decodes a MIME body according to its Content-Transfer-Encoding. */
function decodePart(part: MailhogPart): string {
  const encoding = (part.Headers['Content-Transfer-Encoding']?.[0] ?? '').toLowerCase();
  if (encoding === 'base64') {
    return Buffer.from(part.Body.replace(/\s+/g, ''), 'base64').toString('utf-8');
  }
  if (encoding === 'quoted-printable') {
    return part.Body.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (_, hex: string) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
  }
  return part.Body;
}

/** Full decoded text (all MIME parts) of every message sent to `email`, newest first. */
async function messagesTo(request: APIRequestContext, email: string): Promise<string[]> {
  const response = await request.get(`${urls.mailhog}/api/v2/search`, {
    params: { kind: 'to', query: email },
  });
  expect(response.ok()).toBeTruthy();
  const { items } = (await response.json()) as { items: MailhogMessage[] };
  return items.map((message) =>
    [message.Content, ...(message.MIME?.Parts ?? [])].map(decodePart).join('\n'),
  );
}

/**
 * Waits for an email to `email` containing a link that matches `pathPattern`
 * (e.g. /\/verify-email\/[\w-]+/) and returns the link's path.
 */
export async function waitForEmailLink(
  request: APIRequestContext,
  email: string,
  pathPattern: RegExp,
): Promise<string> {
  let path: string | undefined;
  await expect
    .poll(
      async () => {
        for (const body of await messagesTo(request, email)) {
          path = body.match(pathPattern)?.[0];
          if (path) return true;
        }
        return false;
      },
      { message: `email to ${email} matching ${pathPattern}`, timeout: 15_000 },
    )
    .toBe(true);
  return path!;
}
