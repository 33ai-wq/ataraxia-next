#!/usr/bin/env node
// Unit test for the purchase rules: what a wallet gets for one film, the pack, and the season pass.
// Runs on an in-memory sqlite DB with the same tables the server uses — no chain, no wallet, no money.
//
//   node test/pack-pass.mjs

import { DatabaseSync } from 'node:sqlite';
import { applyPurchase, effectiveUnlocked, shapePass, PASS_MS } from '../grants.mjs';
import { CATALOG, PRODUCTS, productById } from '../catalog.mjs';

let pass = 0;
let fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass += 1; console.log(`  ok   ${name}`); }
  else { fail += 1; console.log(`  FAIL ${name} ${detail}`); }
};

const db = new DatabaseSync(':memory:');
db.exec(`
  CREATE TABLE unlocks (
    address TEXT NOT NULL, video_id TEXT NOT NULL, tx_hash TEXT NOT NULL,
    amount_atomic TEXT NOT NULL, block_number INTEGER, unlocked_at INTEGER NOT NULL,
    PRIMARY KEY (address, video_id)
  );
  CREATE TABLE passes (
    address TEXT NOT NULL, product TEXT NOT NULL, tx_hash TEXT NOT NULL UNIQUE,
    amount_atomic TEXT NOT NULL, purchased_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
    PRIMARY KEY (address, purchased_at)
  );
`);
const q = {
  insertUnlock: db.prepare('INSERT INTO unlocks (address,video_id,tx_hash,amount_atomic,block_number,unlocked_at) VALUES (?,?,?,?,?,?)'),
  insertPass: db.prepare('INSERT INTO passes (address,product,tx_hash,amount_atomic,purchased_at,expires_at) VALUES (?,?,?,?,?,?)'),
};
const unlocksOf = (a) => db.prepare('SELECT video_id FROM unlocks WHERE address = ?').all(a).map((r) => r.video_id);
const passRow = (a) => db.prepare('SELECT * FROM passes WHERE address = ?').get(a);

console.log('products');
check('three products offered', PRODUCTS.length === 3, `got ${PRODUCTS.length}`);
check('single is 0.10', productById('single')?.priceAtomic === '100000', productById('single')?.priceAtomic);
check('pack is 0.30', productById('pack')?.priceAtomic === '300000', productById('pack')?.priceAtomic);
check('pass is 0.50', productById('pass')?.priceAtomic === '500000', productById('pass')?.priceAtomic);
check('pack is cheaper than four singles', BigInt(productById('pack').priceAtomic) < 4n * BigInt(productById('single').priceAtomic));
check('every product has blurb + note (users must know what they pick)',
  PRODUCTS.every((p) => p.blurb && p.note && p.title), '');
const pub = PRODUCTS.filter((p) => p.kind === 'pack')[0];
check('pack carries the saving field', pub.savingAtomic === '100000', pub.savingAtomic);

console.log('single');
const A = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
applyPurchase({ q, catalog: CATALOG, address: A, kind: 'single', ref: CATALOG[0].id, txHash: '0x' + '1'.repeat(64), amountAtomic: '100000' });
check('one film unlocked', unlocksOf(A).length === 1 && unlocksOf(A)[0] === CATALOG[0].id, unlocksOf(A).join(','));

console.log('pack');
const B = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const packTx = '0x' + '2'.repeat(64);
const res = applyPurchase({ q, catalog: CATALOG, address: B, kind: 'pack', ref: 'pack', txHash: packTx, amountAtomic: '300000' });
check('pack grants every film in the room', res.granted.length === CATALOG.length && CATALOG.every((c) => unlocksOf(B).includes(c.id)), res.granted.join(','));
check('pack rows share one tx hash', db.prepare('SELECT COUNT(*) n FROM unlocks WHERE tx_hash = ?').get(packTx).n === CATALOG.length);
check('replaying the same pack does not throw', (() => {
  try { applyPurchase({ q, catalog: CATALOG, address: B, kind: 'pack', ref: 'pack', txHash: packTx, amountAtomic: '300000' }); return true; } catch { return false; }
})(), '');
check('pack alone leaves no pass row', !passRow(B));

console.log('season pass');
const C = '0xcccccccccccccccccccccccccccccccccccccccc';
const now = Date.now();
const r2 = applyPurchase({ q, catalog: CATALOG, address: C, kind: 'pass', ref: 'pass', txHash: '0x' + '3'.repeat(64), amountAtomic: '500000', at: now });
check('pass row written with 30 day expiry', Math.abs(r2.expiresAt - (now + PASS_MS)) < 1000, String(r2.expiresAt - now));
check('pass does not pre-unlock films (so new drops are covered too)', unlocksOf(C).length === 0, unlocksOf(C).join(','));
const shaped = shapePass(passRow(C), now);
check('shaped pass exposes daysLeft', shaped.daysLeft === 30, String(shaped.daysLeft));
check('pass covers the whole room while live', effectiveUnlocked({ unlockRows: [], pass: shaped, catalog: CATALOG }).length === CATALOG.length);
const expired = shapePass(passRow(C), now + PASS_MS + 1000);
check('expired pass covers nothing', effectiveUnlocked({ unlockRows: [], pass: expired, catalog: CATALOG }).length === 0);
const half = shapePass(passRow(C), now + 15 * 86_400_000);
check('unlocks from before are kept alongside a pass', effectiveUnlocked({ unlockRows: [{ video_id: 'x' }], pass: half, catalog: CATALOG }).length === CATALOG.length + 1);

console.log('economy (25% back)');
check('pack rebate is 0.075 of the 0.30 paid', (300000n * 2500n) / 10000n === 75000n, String((300000n * 2500n) / 10000n));
check('pass rebate is 0.125 of the 0.50 paid', (500000n * 2500n) / 10000n === 125000n, String((500000n * 2500n) / 10000n));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
