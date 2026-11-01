/* Student Portfolio System: web server.
   Run with:  node server/index.js     (or: npm start)
   It serves the website (public/) and the API (/api/...). No packages needed: only Node's built-in modules. */

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  console.error(`\nThis project needs Node.js 22.13 or newer (you have ${process.versions.node}).\nDownload the LTS version from https://nodejs.org and try again.\n`);
  process.exit(1);
}

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const db = require('./db');
const C = require('./config');
const { routes, findSession, Rule } = require('./routes');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC = path.join(__dirname, '..', 'public');
const MAX_BODY = 2 * 1024 * 1024;                                  // photos and certificates are sent as text, so allow 2 MB
const SECURE_COOKIE = process.env.NODE_ENV === 'production';       // set NODE_ENV=production when the site is served over https

let h = null;                                                      // the database, ready once start() has run

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8' };

function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
}
function send(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}
function readCookie(req, name) {
  const m = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(name + '='));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : null;
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > MAX_BODY) { reject(new Rule('That upload is too large.', 413)); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch (e) { reject(new Rule('Bad request.', 400)); } });
    req.on('error', reject);
  });
}

async function handleApi(req, res, url) {
  // Protect against other websites making requests for a signed-in person (cross-site request forgery):
  // changes must be JSON, carry our own header, and come from our own origin.
  if (req.method !== 'GET') {
    const origin = req.headers.origin;
    if (origin && new URL(origin).host !== req.headers.host) throw new Rule('Request blocked.', 403);
    if (req.headers['x-requested-with'] !== 'portfolio') throw new Rule('Request blocked.', 403);
    if (!String(req.headers['content-type'] || '').startsWith('application/json')) throw new Rule('Bad request.', 400);
  }
  let found = null, params = [];
  for (const r of Object.values(routes)) {
    if (r.method !== req.method) continue;
    const m = url.pathname.match(r.re);
    if (m) { found = r; params = m.slice(1).map(decodeURIComponent); break; }
  }
  if (!found) throw new Rule('Not found.', 404);

  const session = await findSession(h, readCookie(req, 'sid'));
  let user = null;
  if (found.auth) {
    if (!session) throw new Rule('Please sign in.', 401);
    user = await h.getUser(session.userId);
    if (!user || !user.active) throw new Rule('Please sign in.', 401);
    if (found.admin && user.role !== 'admin') throw new Rule('Administrators only.', 403);
  }
  const body = req.method === 'GET' ? {} : await readBody(req);
  const out = { cookies: [] };
  res.setSession = ({ token, maxAge }) => out.cookies.push(`sid=${token}; HttpOnly; SameSite=Lax; Path=/${maxAge ? `; Max-Age=${maxAge}` : ''}${SECURE_COOKIE ? '; Secure' : ''}`);
  res.clearSession = () => out.cookies.push(`sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${SECURE_COOKIE ? '; Secure' : ''}`);
  const fwd = C.TRUST_PROXY ? String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() : '';
  const origin = C.APP_URL || `${req.headers['x-forwarded-proto'] === 'https' || SECURE_COOKIE ? 'https' : 'http'}://${req.headers.host}`;
  const result = await found.fn({ h, session, user, body, params, origin, ip: fwd || req.socket.remoteAddress || '' }, res);
  if (out.cookies.length) res.setHeader('Set-Cookie', out.cookies);
  send(res, 200, result);
}

function serveStatic(req, res, url) {
  let p = decodeURIComponent(url.pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.normalize(path.join(PUBLIC, p));
  // Never serve anything outside public/, and never hidden files.
  if (!file.startsWith(PUBLIC + path.sep) || path.basename(file).startsWith('.')) { res.writeHead(404); return res.end('Not found'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(req.method === 'HEAD' ? undefined : data);
  });
}

const server = http.createServer(async (req, res) => {
  securityHeaders(res);
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    serveStatic(req, res, url);
  } catch (e) {
    if (e instanceof Rule) return send(res, e.status, { error: e.message, field: e.field });
    console.error(e);                                              // unexpected: log it, but do not show details to the browser
    send(res, 500, { error: 'Something went wrong on the server.' });
  }
});
server.requestTimeout = 15000;

async function start() {
  h = await db.init({ demo: C.DEMO_MODE });
  if (process.argv.includes('--reset')) { console.log('Done. Start the server with: npm start'); await h.close(); process.exit(0); }
  setInterval(() => {                                              // forget expired sessions and links
    h.db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now()).catch(() => {});
    h.db.prepare('DELETE FROM tokens WHERE expires < ?').run(Date.now()).catch(() => {});
  }, 3600000).unref();
  server.listen(PORT, () => {
    console.log(`\nAU Launchpad is running.\nOpen:  http://localhost:${PORT}\nDatabase: ${h.label}\n${C.DEMO_MODE ? 'Demo mode is ON: sample people are loaded and demo logins are listed on the sign-in page.\n' : 'Demo mode is OFF.\n'}`);
  });
}
start().catch(e => { console.error('\nThe server could not start:', e.message, '\n'); process.exit(1); });
