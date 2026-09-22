// End-to-end check of the paid-media gate, through nginx (https://ataraxia.xhagents.xyz).
// Mints a session cookie with the server's own HMAC secret, plants one unlock row,
// then proves: no session -> 401, session without unlock -> 403, unlocked -> 200 + real mp4 bytes.
// Run: node /home/ubuntu/ataraxia/server/test/e2e-gating.mjs
import crypto from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const BASE = process.env.E2E_BASE || 'https://ataraxia.xhagents.xyz';
const SECRET = readFileSync('/home/ubuntu/.ataraxia_session_secret', 'utf8').trim();
const DB_FILE = '/home/ubuntu/ataraxia/server/ataraxia.db';
const TEST_ADDR = '0x1111111111111111111111111111111111111111';
const TEST_TX = '0x' + 'cd'.repeat(32);
const UNLOCKED = 'helixhdna';
const LOCKED = 'rotate21x';

const now = Math.floor(Date.now() / 1000);
const b = Buffer.from(JSON.stringify({ address: TEST_ADDR, iat: now, exp: now + 3600 })).toString('base64url');
const sig = crypto.createHmac('sha256', SECRET).update(b).digest('base64url');
const COOKIE = `ataraxia_sid=${b}.${sig}`;

let failures = 0;
const check = (name, cond, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!cond) failures += 1;
};

const db = new DatabaseSync(DB_FILE);
const planted = db.prepare('SELECT 1 AS x FROM unlocks WHERE address = ? AND video_id = ?').get(TEST_ADDR, UNLOCKED);
if (!planted) {
  db.prepare('INSERT INTO unlocks (address,video_id,tx_hash,amount_atomic,block_number,unlocked_at) VALUES (?,?,?,?,?,?)')
    .run(TEST_ADDR, UNLOCKED, TEST_TX, '100000', 0, Date.now());
}

try {
  // 1. service is reachable through nginx
  const cfg = await (await fetch(`${BASE}/api/config`)).json();
  check('GET /api/config returns Base + payTo', cfg.chainId === 8453 && /^0x[0-9a-fA-F]{40}$/.test(cfg.payTo || ''), `payTo=${cfg.payTo}`);
  check('price is 0.1 USDC (100000 atomic)', cfg.priceAtomic === '100000', `priceAtomic=${cfg.priceAtomic}`);

  const cat = await (await fetch(`${BASE}/api/catalog`)).json();
  check('catalogue exposes 4 animations', Array.isArray(cat.items) && cat.items.length === 4, `items=${cat.items?.length}`);
  check('catalogue leaks no master filename', JSON.stringify(cat).includes('_21x.mp4') === false);

  // 2. gating without a session
  const anon = await fetch(`${BASE}/api/media/${UNLOCKED}`);
  check('anonymous /api/media -> 401', anon.status === 401, `status=${anon.status}`);

  // 3. session but no unlock
  const notPaid = await fetch(`${BASE}/api/media/${LOCKED}`, { headers: { Cookie: COOKIE } });
  check('signed-in but unpaid -> 403', notPaid.status === 403, `status=${notPaid.status}`);

  // 4. session + unlock -> nginx must really stream the master
  const access = await (await fetch(`${BASE}/api/access`, { headers: { Cookie: COOKIE } })).json();
  check('session cookie is accepted (/api/access)',
    access.authed === true && Array.isArray(access.unlocked) && access.unlocked.includes(UNLOCKED),
    `unlocked=${JSON.stringify(access.unlocked)}`);

  const head = await fetch(`${BASE}/api/media/${UNLOCKED}`, { headers: { Cookie: COOKIE } });
  check('unlocked /api/media -> 200', head.status === 200, `status=${head.status} type=${head.headers.get('content-type')}`);
  check('served as video/mp4', (head.headers.get('content-type') || '').includes('video/mp4'));
  const body = await head.arrayBuffer();
  check('master streams real bytes', body.byteLength > 1_000_000, `${body.byteLength} bytes`);
  check('no X-Accel-Redirect leaks to the client', !head.headers.get('x-accel-redirect'),
    String(head.headers.get('x-accel-redirect')));

  const ranged = await fetch(`${BASE}/api/media/${UNLOCKED}`, { headers: { Cookie: COOKIE, Range: 'bytes=0-1023' } });
  check('range request supported (seeking works)', ranged.status === 206, `status=${ranged.status}`);
  const part = await ranged.arrayBuffer();
  check('range payload is 1024 bytes', part.byteLength === 1024, `${part.byteLength} bytes`);

  // 5. the paid masters are not reachable as plain static files
  for (const path of ['/videos/HeliXHDNA_21x.mp4', '/videos/Rotate21x_21x.mp4']) {
    const r = await fetch(`${BASE}${path}`);
    check(`static hotlink blocked: ${path}`, r.status === 404 || r.status === 403, `status=${r.status}`);
  }

  // 6. previews are public and playable
  const prev = await fetch(`${BASE}/videos/previews/helixhdna.mp4`);
  const prevBody = await prev.arrayBuffer();
  check('free 5s preview is public', prev.status === 200 && prevBody.byteLength > 1_000_000, `status=${prev.status} ${prevBody.byteLength} bytes`);

  const poster = await fetch(`${BASE}/videos/posters/helixhdna.jpg`);
  check('poster is public', poster.status === 200 && (poster.headers.get('content-type') || '').includes('image'));

  // 7. the app itself
  const page = await fetch(`${BASE}/`);
  const html = await page.text();
  check('app serves 200', page.status === 200);
  check('app is the refactored build', html.includes('one quiet room on Base'), 'title/description updated');
  const bundle = html.match(/\/assets\/(index-[\w-]+\.js)/);
  check('bundle referenced', Boolean(bundle), bundle?.[1]);
  if (bundle) {
    const js = await (await fetch(`${BASE}/assets/${bundle[1]}`)).text();
    check('bundle has no gameplay leftovers', !/Zen Garden|1000 XP|Seed of Calm|Boundless Ocean|Achievements:/i.test(js));
    check('bundle wires the paid Cinema flow', js.includes('/api/pay/invoice') && js.includes('/api/media/'));
  }
} finally {
  db.prepare('DELETE FROM unlocks WHERE address = ? AND tx_hash = ?').run(TEST_ADDR, TEST_TX);
  console.log('cleaned up test unlock row');
}

console.log(failures === 0 ? '\nALL E2E CHECKS PASSED' : `\n${failures} E2E CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
