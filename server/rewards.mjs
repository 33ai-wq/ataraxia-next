// Ataraxia rewards — pure logic (no I/O), so the money math can be unit-tested.
//
// Business rule from Boss: 25% of every verified payment comes back to the
// people who paid, funded from a dedicated rewards wallet (separate from the
// treasury). No token, no custom/paid contract: the ledger lives in the app's
// own database and payouts are ordinary USDC transfers signed by the rewards
// hot wallet inside the SENTINEL gate.
import { keccak256, toHex } from 'viem';

export const BPS = 10000n;

/** 25% default, expressed in basis points. */
export const DEFAULT_SHARE_BPS = 2500n;

/**
 * Reward accrued from one payment: floor(paid * shareBps / 10000), in USDC atomic units.
 * Floor keeps the app from ever owing more than it took in.
 */
export function accrualFor(paidAtomic, shareBps = DEFAULT_SHARE_BPS) {
  const paid = BigInt(paidAtomic);
  const share = BigInt(shareBps);
  if (paid <= 0n || share <= 0n) return 0n;
  if (share > BPS) throw new Error('shareBps must be <= 10000');
  return (paid * share) / BPS;
}

/** Per-address totals from raw ledger rows. Amounts stay strings/BigInt — never floats. */
export function summarise(rows) {
  const byAddress = new Map();
  let gross = 0n;
  let pool = 0n;
  for (const r of rows) {
    const paid = BigInt(r.amount_paid_atomic);
    const acc = BigInt(r.accrued_atomic);
    gross += paid;
    pool += acc;
    const cur = byAddress.get(r.address) || { address: r.address, paid: 0n, accrued: 0n, payments: 0 };
    cur.paid += paid;
    cur.accrued += acc;
    cur.payments += 1;
    byAddress.set(r.address, cur);
  }
  return { gross, pool, payers: byAddress.size, byAddress };
}

/**
 * Build a payout plan: only addresses whose accrued balance is at or above the
 * threshold, largest first, capped by maxTotal so a batch can never exceed the
 * amount Boss already approved.
 */
export function planPayouts({ balances, minPayoutAtomic, maxTotalAtomic = null, pendingAlreadyPaid = 0n }) {
  const min = BigInt(minPayoutAtomic);
  const plan = [];
  let total = 0n;
  const owed = [...balances]
    .map(([address, accrued]) => ({ address, accrued: BigInt(accrued) - BigInt(pendingAlreadyPaid || 0n) }))
    .filter((c) => c.accrued > 0n);
  const candidates = owed
    .filter((c) => c.accrued >= min)
    .sort((a, b) => (b.accrued > a.accrued ? 1 : b.accrued < a.accrued ? -1 : 0));

  for (const c of candidates) {
    if (maxTotalAtomic != null && total + c.accrued > BigInt(maxTotalAtomic)) continue;
    plan.push(c);
    total += c.accrued;
  }
  // skipped = everyone who is owed something but is not in this batch
  // (below the threshold, or held back by the batch cap)
  return { plan, total, skipped: owed.length - plan.length };
}

/**
 * Verifiable randomness without an oracle or a contract: the draw seed is the
 * hash of a BASE BLOCK THAT DID NOT EXIST when the draw was announced. Anyone
 * can re-check it later from the chain — no third party, no cost.
 *
 * @param {string} blockHash  hash of the pre-announced Base block
 * @param {string} drawId     e.g. "2026-09-22"
 */
export function drawSeed(blockHash, drawId) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(blockHash || '')) throw new Error('bad block hash');
  return keccak256(toHex(`${blockHash}:${drawId}:ataraxia`));
}

/**
 * Weighted pick of one winner: weight = what the address paid that day, so the
 * more you bought the better your odds, but every payer can win.
 * Deterministic given (seed, entries) → reproducible and auditable.
 */
export function pickWeightedWinner(seed, entries) {
  const list = entries.filter((e) => BigInt(e.weightAtomic) > 0n);
  if (!list.length) throw new Error('no eligible entries');
  const totalWeight = list.reduce((s, e) => s + BigInt(e.weightAtomic), 0n);
  const roll = BigInt(seed) % totalWeight; // 0..totalWeight-1
  let cursor = 0n;
  for (const e of list) {
    cursor += BigInt(e.weightAtomic);
    if (roll < cursor) return e;
  }
  return list[list.length - 1];
}

/** Format atomic USDC (6 dp) for humans without floating point surprises. */
export function formatUsdc(atomic, dp = 4) {
  const v = BigInt(atomic);
  const whole = v / 1_000_000n;
  const frac = (v % 1_000_000n).toString().padStart(6, '0').slice(0, dp);
  return `${whole}.${frac}`;
}
