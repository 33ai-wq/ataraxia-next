#!/usr/bin/env node
// Live check of the paid options on the running Ataraxia service — no money is spent.
//
// It signs in with the test wallet (a signature, not a payment), asks for one invoice per option,
// and verifies that a live season pass really does open the gated media route. Everything it writes
// to the database it removes again in a finally block.
//
//   node test/invoice-products.mjs

import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { privateKeyToAccount } from 'viem/accounts';

const BASE = process.env.ATARAXIA_BASE || 'http://127.0.0.1:3110';
const KEY_FILE = process.env.ATARAXIA_TEST_KEY || '/home/ubuntu/prpo_ai/keys/x402_test_payer.key';
const DB_FILE = process.env.ATARAXIA_DB_FILE || '/home/ubuntu/ataraxia/ataraxia-react/server/ataraxia.db';

let pass = 0;
let fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass += 1; console.log(`  ok   ${name}`); }
  else { fail += 1; console.log(`  FAIL ${name} ${detail}`); }
};
const j = async (path, opts = {}) => {
  const r = await fetch(`${BASE}${path}`, opts);
  let body = null;
  try { body = await r.json(); } catch { body = null; }
  return { status: r.status, body, headers: r.headers };
};

const key = readFileSync(KEY_FILE, 'utf8').trim();
const account = privateKeyToAccount(key.startsWith('0x') ? key : `0x${key}`);
const address = account.address.toLowerCase();
console.log(`test wallet ${address}`);
console.log(`target      ${BASE}\n`);

console.log('config');
const cfg = await j('/api/config');
check('/api/config answers', cfg.status === 200, `status=${cfg.status}`);
const products = cfg.body?.products || [];
check('three options published', products.length === 3, `got ${products.length}`);
check('prices are 0.10 / 0.30 / 0.50',
  products.map((p) => p.priceAtomic).join(',') === '100000,300000,500000',
  products.map((p) => p.priceAtomic).join(','));
check('each option explains itself (title + blurb + note)',
  products.every((p) => p.title && p.blurb && p.note), JSON.stringify(products));
check('pass length published as 30 days', cfg.body?.passDays === 30, String(cfg.body?.passDays));
check('rebate stated as 25%', cfg.body?.rebate?.shareBps === 2500, String(cfg.body?.rebate?.shareBps));

console.log('\ngating before sign-in');
const anon = await j('/api/pay/invoice', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ productId: 'pack' }),
});
check('invoice without a session -> 401', anon.status === 401, `status=${anon.status}`);

console.log('\nsign in');
const nonce = (await j(`/api/nonce?address=${address}`)).body?.nonce;
check('nonce issued', Boolean(nonce), String(nonce));
const message = `Sign in to Ataraxia\n\nAddress: ${address}\nNonce: ${nonce}\nIssued: ${new Date().toISOString()}`;
const signature = await account.signMessage({ message });
const auth = await j('/api/auth/verify', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address, message, signature }),
});
check('sign-in accepted', auth.body?.ok === true, JSON.stringify(auth.body));
const cookie = String(auth.headers.get('set-cookie') || '').split(';')[0];
check('session cookie issued', cookie.includes('ataraxia'), cookie.slice(0, 30));
const withCookie = (body) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json', cookie },
  body: JSON.stringify(body),
});

console.log('\ninvoices on the live service');
const catalog = (await j('/api/catalog')).body?.items || [];
const one = await j('/api/pay/invoice', withCookie({ videoId: catalog[0].id }));
check('single film invoice is 0.10', one.body?.amountAtomic === '100000' && one.body?.productId === 'single',
  JSON.stringify({ a: one.body?.amountAtomic, p: one.body?.productId }));
const pack = await j('/api/pay/invoice', withCookie({ productId: 'pack' }));
check('pack invoice is 0.30', pack.body?.amountAtomic === '300000', String(pack.body?.amountAtomic));
check('pack invoice lists all four films', Array.isArray(pack.body?.coversVideos) && pack.body.coversVideos.length === catalog.length,
  JSON.stringify(pack.body?.coversVideos));
check('pack invoice names the option', pack.body?.productTitle === 'All four films', String(pack.body?.productTitle));
const season = await j('/api/pay/invoice', withCookie({ productId: 'pass' }));
check('pass invoice is 0.50', season.body?.amountAtomic === '500000', String(season.body?.amountAtomic));
check('pass invoice states what it covers', /added during the pass/.test(String(season.body?.coversVideos)),
  String(season.body?.coversVideos));
const bogus = await j('/api/pay/invoice', withCookie({ productId: 'lifetime-everything' }));
check('unknown option refused', bogus.status === 400 && bogus.body?.error === 'unknown_product', JSON.stringify(bogus.body));

console.log('\nno purchase yet -> nothing opens');
const access = await j('/api/access', { headers: { cookie } });
check('access shows no films for an unpaid wallet', (access.body?.unlocked || []).length === 0, JSON.stringify(access.body?.unlocked));
const locked = await j(`/api/media/${catalog[0].id}`, { headers: { cookie } });
check('media route still refuses an unpaid wallet (403)', locked.status === 403, `status=${locked.status}`);

console.log('\na live pass opens the room (planted row, removed again)');
const db = new DatabaseSync(DB_FILE);
const now = Date.now();
const txh = `0x${'f'.repeat(64)}`;
let planted = false;
try {
  db.prepare('INSERT OR REPLACE INTO passes (address,product,tx_hash,amount_atomic,purchased_at,expires_at) VALUES (?,?,?,?,?,?)')
    .run(address, 'pass', txh, '500000', now, now + 30 * 86_400_000);
  planted = true;
  const withPass = await j('/api/access', { headers: { cookie } });
  check('access now reports the pass', withPass.body?.pass && withPass.body.pass.daysLeft === 30, JSON.stringify(withPass.body?.pass));
  check('pass unlocks the whole room', (withPass.body?.unlocked || []).length === catalog.length,
    String((withPass.body?.unlocked || []).length));
  const opened = await j(`/api/media/${catalog[0].id}`, { headers: { cookie } });
  check('gated media now streams (200 + x-accel)', opened.status === 200 && Boolean(opened.headers.get('x-accel-redirect')),
    `status=${opened.status}`);
  const again = await j('/api/pay/invoice', withCookie({ productId: 'pass' }));
  check('second pass is refused with the days left', again.body?.alreadyActive === true && again.body?.daysLeft === 30,
    JSON.stringify(again.body));
  db.prepare('UPDATE passes SET expires_at = ? WHERE address = ? AND tx_hash = ?').run(now - 1000, address, txh);
  const afterExpiry = await j('/api/access', { headers: { cookie } });
  check('expired pass no longer covers the room', (afterExpiry.body?.unlocked || []).length === 0,
    JSON.stringify(afterExpiry.body?.unlocked));
  const closed = await j(`/api/media/${catalog[0].id}`, { headers: { cookie } });
  check('gated media closes again after expiry', closed.status === 403, `status=${closed.status}`);
} finally {
  if (planted) db.prepare('DELETE FROM passes WHERE address = ? AND tx_hash = ?').run(address, txh);
  db.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
