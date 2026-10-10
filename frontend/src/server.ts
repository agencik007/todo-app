import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import { environment } from './environments/environment';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

app.disable('x-powered-by');

/**
 * Security headers for every response (HTML and static assets).
 *
 * The CSP mirrors what the app actually needs:
 * - scripts only from our own origin (theme-init.js is external, no inline JS),
 * - styles need 'unsafe-inline' because Angular/PrimeNG inject <style> tags at
 *   runtime; fonts are self-hosted, so no third-party style/font origins,
 * - connect-src covers the backend API and the open-meteo weather API,
 * - avatars are rendered from blob: URLs created out of IndexedDB.
 *
 * Strict-Transport-Security is intentionally not set here: it must be added by
 * the TLS-terminating proxy once the app is served over HTTPS.
 */
const apiOrigin = ((): string => {
  try {
    return new URL(environment.apiUrl).origin;
  } catch {
    return ''; // relative apiUrl -> same origin, already covered by 'self'
  }
})();

const contentSecurityPolicy = [
  `default-src 'self'`,
  `script-src 'self'`,
  `style-src 'self' 'unsafe-inline'`,
  `font-src 'self'`,
  `img-src 'self' data: blob:`,
  `connect-src 'self' ${apiOrigin} https://api.open-meteo.com`.replace(
    /\s+/g,
    ' ',
  ),
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `frame-ancestors 'self'`,
].join('; ');

app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', contentSecurityPolicy);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Permissions-Policy',
    'geolocation=(self), camera=(), microphone=(), payment=()',
  );
  next();
});

/**
 * Example Express Rest API endpoints can be defined here.
 * Uncomment and define endpoints as necessary.
 *
 * Example:
 * ```ts
 * app.get('/api/{*splat}', (req, res) => {
 *   // Handle API request
 * });
 * ```
 */

/**
 * Serve static files from /browser.
 * Only build outputs with a content hash in their name (main-XXXX.js,
 * media/...) can be cached for a year. Unhashed files - translations in
 * assets/i18n, theme-init.js, icons - must be revalidated, otherwise
 * browsers keep serving copies from before the last deploy (e.g. a pl.json
 * without newly added keys).
 */
const HASHED_FILE = /-[A-Z0-9]{8,}\.(js|css)$|[\\/]media[\\/]/;

app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
    setHeaders: (res, filePath) => {
      if (!HASHED_FILE.test(filePath)) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url)) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
