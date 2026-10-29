import { request as playwrightRequest } from '@playwright/test';

import { createVerifiedUser, loginViaApi } from './api';
import { urls } from './env';

/**
 * Loads the embedding model before the tests start. The e2e backend runs with
 * TESTING=1, which skips the startup warm-up, so each of its uvicorn workers
 * loads the model on the first todo create or suggestion - under the load of
 * a parallel run that takes up to ~20 s and times tests out. Concurrent
 * suggestion requests reach every worker; a round where all of them answer
 * fast means the workers are warm.
 */
export default async function globalSetup(): Promise<void> {
  const request = await playwrightRequest.newContext();
  try {
    const token = await loginViaApi(request, await createVerifiedUser(request));
    const suggest = async (): Promise<number> => {
      const started = Date.now();
      const response = await request.post(`${urls.api}/todos/suggest-group`, {
        data: { title: 'Warm-up' },
        headers: { Authorization: `Bearer ${token}` },
        timeout: 120_000,
      });
      // Suggestions are switched off (AI_SUGGESTIONS_ENABLED=false): nothing to load.
      if (response.status() === 503) return 0;
      if (!response.ok()) {
        throw new Error(`Model warm-up failed: ${response.status()} ${await response.text()}`);
      }
      return Date.now() - started;
    };
    for (let round = 0; round < 10; round++) {
      const times = await Promise.all(Array.from({ length: 6 }, suggest));
      if (round > 0 && Math.max(...times) < 1_000) return;
    }
  } finally {
    await request.dispose();
  }
}
