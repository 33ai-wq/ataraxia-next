#!/usr/bin/env node
// Ataraxia rewards — payout runner.
//
// DEFAULTS TO DRY RUN. Nothing is signed unless --execute is passed, and that
// additionally requires the SENTINEL GATE protocol (prpo_ai/SENTINEL_GATE_PROTOCOL.md):
//   * a matching Sentinel ticket  -> SENTINEL_TICKET=<id>
//   * BOSSY's explicit confirmation for any transfer above 1 USD -> BOSS_APPROVED=1
//
//   node scripts/pay_rewards.mjs                       # dry run, prints the plan
//   node scripts/pay_rewards.mjs --cap 1               # dry run, capped at $1
//   SENTINEL_TICKET=SG-123 BOSS_APPROVED=1 node scripts/pay_rewards.mjs --execute
//
// One plain USDC transfer per eligible wallet, sent from the rewards hot wallet,
// paid only when the accrued balance is at or above the threshold.
import crypto from 'node:crypto';
import { readFileSync, statSync, existsSync } from 'node:fs';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { buildReport, printReport, cfg, publicClient, openDb, USDC_ABI } from './rewards-common.mjs';

const args = process.argv.slice(2);
const execute = args.includes('--execute');
const capIdx = args.indexOf('--cap');
const capAtomic = capIdx >= 0
  ? BigInt(Math.round(Number(args[capIdx + 1]) * 1_000_000))
  : 1_000_000n; // default: never move more than 1 USD without BOSS_APPROVED

const BOSS_APPROVED = process.env.BOSS_APPROVED === '1';
const SENTINEL_TICKET = process.env.SENTINEL_TICKET || '';

const report = await buildReport({ maxTotalAtomic: capAtomic });
printReport(report);

const total = report.planTotal;
if (!report.plan.length) {
  console.log('nothing to pay — exiting');
  process.exit(0);
}

console.log(`batch cap: ${Number(capAtomic) / 1e6} USDC · over cap: ${total > capAtomic ? 'YES (blocked)' : 'no'}`);
if (!execute) {
  console.log('\nDRY RUN — no transaction signed. Re-run with --execute and a Sentinel ticket to pay.');
  process.exit(0);
}

// ---- gates (fail closed, in order) ----
if (total > capAtomic) {
  console.error(`REFUSED: batch ${Number(total) / 1e6} USDC exceeds the cap ${Number(capAtomic) / 1e6} USDC`);
  process.exit(2);
}
if (total > 1_000_000n && !BOSS_APPROVED) {
  console.error('REFUSED: transfers above 1 USD need BOSSY\'s explicit confirmation (SENTINEL_GATE_PROTOCOL.md) → set BOSS_APPROVED=1');
  process.exit(2);
}
if (!SENTINEL_TICKET) {
  console.error('REFUSED: no Sentinel ticket. Submit {requesting_agent:"Treasury", action:"rewards payout", amount_or_claim:<total>, source_data:"rewards_ledger", confidence} first and export SENTINEL_TICKET=<id>');
  process.exit(2);
}
if (!existsSync(cfg.keyFile)) {
  console.error(`REFUSED: rewards key not found at ${cfg.keyFile}`);
  process.exit(2);
}
const mode = statSync(cfg.keyFile).mode & 0o777;
if (mode !== 0o600) {
  console.error(`REFUSED: ${cfg.keyFile} must be mode 600 (currently ${mode.toString(8)})`);
  process.exit(2);
}

const account = privateKeyToAccount(readFileSync(cfg.keyFile, 'utf8').trim());
if (account.address.toLowerCase() !== cfg.rewardsAddress.toLowerCase()) {
  console.error(`REFUSED: key belongs to ${account.address}, not the configured rewards wallet ${cfg.rewardsAddress}`);
  process.exit(2);
}

// A flaky RPC must never crash the runner — it has to refuse, loudly and safely.
let balance;
let eth;
try {
  balance = await publicClient.readContract({ address: cfg.usdc, abi: USDC_ABI, functionName: 'balanceOf', args: [cfg.rewardsAddress] });
  eth = await publicClient.getBalance({ address: cfg.rewardsAddress });
} catch (e) {
  console.error(`REFUSED: could not read the rewards wallet from the RPC (${e?.shortMessage || e?.message}) — nothing signed, try again`);
  process.exit(2);
}
if (balance < total) {
  console.error(`REFUSED: rewards wallet holds ${balance} atomic USDC but the batch needs ${total} — sweep from the treasury first`);
  process.exit(2);
}
console.log(`\nSENTINEL TICKET ${SENTINEL_TICKET} accepted — paying ${report.plan.length} wallet(s), total ${Number(total) / 1e6} USDC`);
console.log(`rewards wallet ${cfg.rewardsAddress} · USDC ${balance} atomic · ETH ${eth} wei`);

const wallet = createWalletClient({ account, chain: base, transport: http(cfg.rpc, { timeout: 30000 }) });
const db = openDb();
const insert = db.prepare(
  'INSERT INTO rewards_payouts (id,address,amount_atomic,tx_hash,status,ticket,created_at) VALUES (?,?,?,?,?,?,?)',
);

let paid = 0n;
for (const p of report.plan) {
  const id = crypto.randomUUID();
  try {
    const hash = await wallet.writeContract({
      address: cfg.usdc,
      abi: USDC_ABI,
      functionName: 'transfer',
      args: [p.address, p.accrued],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1, timeout: 120_000 });
    const status = receipt.status === 'success' ? 'sent' : 'failed';
    insert.run(id, p.address, p.accrued.toString(), hash, status, SENTINEL_TICKET, Date.now());
    paid += p.accrued;
    console.log(`${status === 'sent' ? 'SENT' : 'FAILED'}  ${p.address}  ${Number(p.accrued) / 1e6} USDC  ${hash}`);
  } catch (e) {
    insert.run(id, p.address, p.accrued.toString(), null, 'failed', SENTINEL_TICKET, Date.now());
    console.error(`FAILED  ${p.address}  ${e?.shortMessage || e?.message}`);
  }
}
db.close();
console.log(`\ndone — ${Number(paid) / 1e6} USDC sent to ${report.plan.length} wallet(s)`);
