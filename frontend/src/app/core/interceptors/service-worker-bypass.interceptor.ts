import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { API_URL } from '../tokens/api-url.token';

/**
 * Sends requests to third-party APIs (weather, place names) past the service
 * worker. The worker fetches what it handles itself, under the CSP it was
 * installed with, and the browser re-installs it only when its script
 * changes, not its headers: a host added to connect-src later stays blocked
 * there (the worker answers 504) until the next Angular update. Bypassed
 * requests go straight to the network under the page's current CSP.
 */
export const serviceWorkerBypassInterceptor: HttpInterceptorFn = (
  req,
  next,
) => {
  const isThirdParty =
    /^https?:\/\//.test(req.url) && !req.url.startsWith(inject(API_URL));
  return next(
    isThirdParty ? req.clone({ setParams: { 'ngsw-bypass': 'true' } }) : req,
  );
};
