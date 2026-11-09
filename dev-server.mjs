// Local preview server only (not used on Vercel). Serves public/ and the same /api/status handler.
// Binds to 127.0.0.1, accepts same-origin requests only, and refuses every write method.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {handleStatus} from './api/status.mjs';

const PORT = Number(process.env.PORT) || 40611;
const types = {html: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8', svg: 'image/svg+xml'};
const files = new Set(['index.html', 'style.css', 'app.js', 'state.js', 'live.js', 'favicon.svg']);
const aliases = {'/': 'index.html', '/review-v4.html': 'index.html'};
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
};
let windowStart = 0, count = 0;

const server = http.createServer(async (req, res) => {
  for (const [k, v] of Object.entries(securityHeaders)) res.setHeader(k, v);
  const reply = (code, data) => { res.writeHead(code, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'}); res.end(JSON.stringify(data)); };
  const expected = '127.0.0.1:' + server.address().port;
  if (req.headers.host !== expected || (req.headers.origin && req.headers.origin !== 'http://' + expected) || req.headers['sec-fetch-site'] === 'cross-site') return reply(403, {error: 'Local same-origin requests only'});
  if (req.method !== 'GET' && req.method !== 'HEAD') { req.resume(); return reply(403, {error: 'Writes disabled. A new fictional app-origin write requires approval.'}); }
  const url = new URL(req.url, 'http://' + expected);
  if (url.pathname === '/api/status') {
    if (Date.now() - windowStart > 60000) { windowStart = Date.now(); count = 0; }
    if (++count > 10) { res.setHeader('Retry-After', '60'); return reply(429, {error: 'Please wait before checking again.'}); }
    const r = await handleStatus(new Request('http://' + expected + req.url, {method: req.method, headers: Object.entries(req.headers).filter(([, v]) => typeof v === 'string')}));
    res.writeHead(r.status, {...Object.fromEntries(r.headers), 'Cache-Control': 'no-store'});
    return res.end(req.method === 'HEAD' ? undefined : Buffer.from(await r.arrayBuffer()));
  }
  const name = aliases[url.pathname] || url.pathname.slice(1);
  if (!files.has(name)) return reply(404, {error: 'Not found'});
  try {
    const body = await readFile(new URL('./public/' + name, import.meta.url));
    res.writeHead(200, {'Content-Type': types[name.split('.').pop()], 'Cache-Control': 'no-store'});
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch { reply(404, {error: 'Not found'}); }
});
server.listen(PORT, '127.0.0.1', () => console.log(JSON.stringify({url: 'http://127.0.0.1:' + server.address().port, pid: process.pid, writesEnabled: false})));
