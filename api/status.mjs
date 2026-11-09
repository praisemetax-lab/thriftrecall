// Vercel Function: GET /api/status — read-only. No write route exists in this deployment.
import {getStatus} from '../lib/live-status.mjs';

const ALLOWED_ACCEPT = new Set(['', '*/*', 'application/json']);
const json = (status, body, headers = {}) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff', ...headers}});
const noStore = {'Cache-Control': 'no-store'};

export function handleStatus(request) {
  const url = new URL(request.url);
  if (request.method !== 'GET' && request.method !== 'HEAD') return json(405, {error: 'Read-only demo. Writes are disabled.'}, {...noStore, Allow: 'GET, HEAD'});
  // Each distinct query string or Accept value is a separate CDN cache entry, so reject them to stop cache-busting.
  if (url.search) return json(400, {error: 'No query parameters accepted.'}, noStore);
  if (!ALLOWED_ACCEPT.has((request.headers.get('accept') || '').trim())) return json(406, {error: 'Use Accept: application/json.'}, noStore);
  if (request.headers.get('sec-fetch-site') === 'cross-site') return json(403, {error: 'Same-site requests only.'}, noStore);
  return getStatus().then(
    data => json(200, data, {
      'Cache-Control': 'public, max-age=60',          // browsers: 1 minute
      'Vercel-CDN-Cache-Control': 'max-age=300',     // Vercel CDN: 5 minutes, shared by all visitors
    }),
    () => json(503, {error: 'Read check unavailable. No write attempted.'}, noStore),
  );
}

export default {fetch: handleStatus};
