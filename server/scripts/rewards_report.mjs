#!/usr/bin/env node
// Ataraxia rewards — READ-ONLY report. Never moves money.
//
//   node scripts/rewards_report.mjs             # ledger + plan + wallet balance
//   node scripts/rewards_report.mjs --cap 1     # what a $1 batch would pay
//
// Use this to decide how much to sweep from the treasury into the rewards
// wallet: "awaiting payout" (plus a small gas buffer) is the exact figure owed.
import { buildReport, printReport, cfg } from './rewards-common.mjs';

const args = process.argv.slice(2);
const capIdx = args.indexOf('--cap');
const cap = capIdx >= 0 ? BigInt(Math.round(Number(args[capIdx + 1]) * 1_000_000)) : null;

const report = await buildReport({ maxTotalAtomic: cap });
printReport(report);
console.log(`treasury→rewards sweep needed: ${(Number(report.awaiting) / 1e6).toFixed(4)} USDC`);
console.log(`(config: ${cfg.policy} · threshold ${Number(cfg.minPayoutAtomic) / 1e6} USDC · key ${cfg.keyFile})`);
