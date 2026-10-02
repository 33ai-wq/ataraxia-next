#!/usr/bin/env node
// Ataraxia economics — runs the REAL rewards module against the configured values,
// so the numbers in any report come from the code that will actually pay out.
// Run: node /home/ubuntu/ataraxia/ataraxia-react/server/test/rewards-econ.mjs
import { accrualFor, planPayouts, summarise, formatUsdc, DEFAULT_SHARE_BPS } from '../rewards.mjs';

const PRICE = 100000n;              // 0.10 USDC per long video
const SHARE = 2500n;               // 25% (ATARAXIA_REWARDS_SHARE_BPS)
const MIN_PAYOUT = 50000n;         // 0.05 USDC threshold
const VIDEOS = 4;

console.log(`price per video ${formatUsdc(PRICE)} USDC · rebate ${Number(SHARE) / 100}% · payout threshold ${formatUsdc(MIN_PAYOUT)} USDC`);
console.log('');
console.log('views | pays      | accrues   | payable now? | net cost after rebate');
console.log('------+-----------+-----------+--------------+----------------------');
for (let views = 1; views <= 8; views++) {
  const paid = PRICE * BigInt(views);
  const accrued = accrualFor(paid, SHARE);
  const payable = accrued >= MIN_PAYOUT ? 'yes' : 'no (below threshold)';
  console.log(
    `${String(views).padStart(5)} | ${formatUsdc(paid).padEnd(9)} | ${formatUsdc(accrued).padEnd(9)} | ${payable.padEnd(12)} | ${formatUsdc(paid - accrued)} USDC`,
  );
}

console.log('');
// what one viewer costs to watch all four videos, and what the platform keeps
const allViews = PRICE * BigInt(VIDEOS);
const allAccrued = accrualFor(allViews, SHARE);
console.log(`all ${VIDEOS} videos: viewer pays ${formatUsdc(allViews)}, gets back ${formatUsdc(allAccrued)}, net ${formatUsdc(allViews - allAccrued)} USDC`);

// payout plan shape for a few viewers (biggest first, capped like the runner does)
const rows = [
  { address: '0xaaa', amount_paid_atomic: (PRICE * 4n).toString(), accrued_atomic: accrualFor(PRICE * 4n, SHARE).toString() },
  { address: '0xbbb', amount_paid_atomic: (PRICE * 2n).toString(), accrued_atomic: accrualFor(PRICE * 2n, SHARE).toString() },
  { address: '0xccc', amount_paid_atomic: PRICE.toString(), accrued_atomic: accrualFor(PRICE, SHARE).toString() },
];
const s = summarise(rows);
const plan = planPayouts({ balances: new Map([...s.byAddress].map(([a, v]) => [a, v.accrued])), minPayoutAtomic: MIN_PAYOUT });
console.log('');
console.log(`3 viewers want in: 0xaaa (4 views), 0xbbb (2), 0xccc (1) -> gross ${formatUsdc(s.gross)}, pool ${formatUsdc(s.pool)}`);
console.log(`payout run would send ${plan.plan.length} transfer(s) totalling ${formatUsdc(plan.total)} USDC; ${plan.skipped} viewer(s) stay accrued (under ${formatUsdc(MIN_PAYOUT)})`);
console.log(`default share from the module: ${Number(DEFAULT_SHARE_BPS) / 100}%`);
