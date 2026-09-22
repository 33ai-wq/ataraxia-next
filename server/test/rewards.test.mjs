// Unit tests for the rewards math (no network, no DB).
import test from 'node:test';
import assert from 'node:assert/strict';
import { accrualFor, summarise, planPayouts, drawSeed, pickWeightedWinner, formatUsdc } from '../rewards.mjs';

test('25% of a 0.1 USDC payment is 0.025 USDC', () => {
  assert.equal(accrualFor(100_000n), 25_000n);
});

test('10 payers of 0.1 produce a 0.25 USDC pool', () => {
  const rows = Array.from({ length: 10 }, (_, i) => ({
    address: `0x${i}`,
    amount_paid_atomic: '100000',
    accrued_atomic: accrualFor(100_000n).toString(),
  }));
  const s = summarise(rows);
  assert.equal(s.gross, 1_000_000n);
  assert.equal(s.pool, 250_000n);
  assert.equal(formatUsdc(s.pool), '0.2500');
  assert.equal(s.payers, 10);
});

test('accrual floors, never over-credits', () => {
  assert.equal(accrualFor(3n), 0n);          // 25% of 3 atomic = 0.75 -> 0
  assert.equal(accrualFor(100_000n, 3333n), 33_330n);
});

test('rejects a share above 100%', () => {
  assert.throws(() => accrualFor(1000n, 10_001n));
});

test('plan only pays balances at or above the threshold', () => {
  const balances = new Map([
    ['0xbig', 90_000n],   // 0.09
    ['0xsmall', 10_000n], // 0.01 -> below a 0.05 threshold
    ['0xmid', 60_000n],   // 0.06
  ]);
  const { plan, total, skipped } = planPayouts({ balances, minPayoutAtomic: 50_000n });
  assert.deepEqual(plan.map((p) => p.address), ['0xbig', '0xmid']); // largest first
  assert.equal(total, 150_000n);
  assert.equal(skipped, 1);
});

test('plan respects the approved cap (never overspends a batch)', () => {
  const balances = new Map([['0xa', 800_000n], ['0xb', 400_000n]]);
  const { plan, total } = planPayouts({ balances, minPayoutAtomic: 1n, maxTotalAtomic: 1_000_000n });
  assert.deepEqual(plan.map((p) => p.address), ['0xa']);
  assert.equal(total, 800_000n);
});

test('previous payouts reduce the remaining balance', () => {
  const balances = new Map([['0xa', 100_000n]]);
  const { plan } = planPayouts({ balances, minPayoutAtomic: 50_000n, pendingAlreadyPaid: 60_000n });
  assert.equal(plan.length, 0);
});

test('draw seed needs a real block hash and is deterministic', () => {
  const h = '0x' + 'ab'.repeat(32);
  assert.throws(() => drawSeed('0x1234', '2026-09-22'));
  assert.equal(drawSeed(h, '2026-09-22'), drawSeed(h, '2026-09-22'));
  assert.notEqual(drawSeed(h, '2026-09-22'), drawSeed(h, '2026-09-23'));
});

test('weighted draw is deterministic and always lands on a payer', () => {
  const seed = drawSeed('0x' + 'cd'.repeat(32), '2026-09-22');
  const entries = [
    { address: '0xa', weightAtomic: 100_000n },
    { address: '0xb', weightAtomic: 200_000n },
    { address: '0xc', weightAtomic: 700_000n },
  ];
  const w = pickWeightedWinner(seed, entries);
  assert.ok(entries.some((e) => e.address === w.address));
  assert.equal(pickWeightedWinner(seed, entries).address, w.address); // reproducible
});

test('weighted draw never picks a zero-weight entry', () => {
  const seed = drawSeed('0x' + 'ef'.repeat(32), 'x');
  for (let i = 0; i < 50; i += 1) {
    const w = pickWeightedWinner(seed + i, [
      { address: '0xzero', weightAtomic: 0n },
      { address: '0xpaid', weightAtomic: 5n },
    ]);
    assert.equal(w.address, '0xpaid');
  }
});

test('formatUsdc keeps atomic precision', () => {
  assert.equal(formatUsdc(0n), '0.0000');
  assert.equal(formatUsdc(1n), '0.0000');
  assert.equal(formatUsdc(1_234_567n), '1.2345');
  assert.equal(formatUsdc(25_000n), '0.0250');
});
