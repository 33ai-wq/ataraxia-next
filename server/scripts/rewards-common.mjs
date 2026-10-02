// Shared helpers for the rewards CLI scripts: config, DB, on-chain reads.
import { readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { createPublicClient, isAddress, formatUnits } from 'viem';
import { base } from 'viem/chains';
import { baseTransport } from '../rpc.mjs';
import { planPayouts, formatUsdc } from '../rewards.mjs';

export const SERVER_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Minimal .env loader so the scripts behave like the service does. */
export function loadEnv(file = join(SERVER_DIR, '.env')) {
  const out = { ...process.env };
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      // Real environment wins over the .env file: systemd passes EnvironmentFile
      // values as real env, and tests/CLI overrides must not be clobbered.
      if (m && out[m[1]] === undefined) out[m[1]] = m[2];
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
    }
  }
  return out;
}

export const env = loadEnv();

export const cfg = {
  rpc: env.ATARAXIA_RPC || 'https://mainnet.base.org',
  dbFile: env.ATARAXIA_DB_FILE || join(SERVER_DIR, 'ataraxia.db'),
  usdc: env.ATARAXIA_USDC || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  rewardsAddress: env.ATARAXIA_REWARDS_ADDRESS || '0x3726570F9F73a7dB7437fEE42C8B4887A59E1dcC',
  keyFile: env.ATARAXIA_REWARDS_KEY_FILE || '/home/ubuntu/prpo_ai/keys/ataraxia_rewards.key',
  minPayoutAtomic: env.ATARAXIA_REWARDS_MIN_PAYOUT_ATOMIC || '50000',
  shareBps: env.ATARAXIA_REWARDS_SHARE_BPS || '2500',
  policy: env.ATARAXIA_REWARDS_POLICY || 'rebate',
};

if (!isAddress(cfg.rewardsAddress)) throw new Error(`bad rewards address: ${cfg.rewardsAddress}`);

export const publicClient = createPublicClient({ chain: base, transport: baseTransport() });

export function openDb(file = cfg.dbFile) {
  if (!existsSync(file)) throw new Error(`db not found: ${file}`);
  return new DatabaseSync(file);
}

export const USDC_ABI = [
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'to', type: 'address' }, { name: 'value', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
];

/** Reads the ledger and produces the payout plan + the funding position. */
export async function buildReport({ maxTotalAtomic = null } = {}) {
  const db = openDb();
  const ledger = db.prepare('SELECT * FROM rewards_ledger').all();
  const sentRows = db.prepare("SELECT address, amount_atomic FROM rewards_payouts WHERE status = 'sent'").all();

  const accruedByAddress = new Map();
  let gross = 0n;
  let pool = 0n;
  for (const r of ledger) {
    gross += BigInt(r.amount_paid_atomic);
    pool += BigInt(r.accrued_atomic);
    accruedByAddress.set(r.address, (accruedByAddress.get(r.address) || 0n) + BigInt(r.accrued_atomic));
  }

  const alreadySentTotal = sentRows.reduce((s, r) => s + BigInt(r.amount_atomic), 0n);
  const { plan, total, skipped } = planPayouts({
    balances: accruedByAddress,
    minPayoutAtomic: cfg.minPayoutAtomic,
    maxTotalAtomic,
  });

  let walletBalance = null;
  try {
    walletBalance = await publicClient.readContract({
      address: cfg.usdc,
      abi: USDC_ABI,
      functionName: 'balanceOf',
      args: [cfg.rewardsAddress],
    });
  } catch (e) {
    walletBalance = null; // offline is fine for a dry run
  }

  db.close();
  return {
    gross, pool, payers: accruedByAddress.size, alreadySentTotal,
    awaiting: pool > alreadySentTotal ? pool - alreadySentTotal : 0n,
    plan, planTotal: total, skipped, walletBalance,
  };
}

export function printReport(r) {
  const usd = (v) => `${formatUsdc(v)} USDC`;
  console.log('──────────────────────────────────────────────');
  console.log(`Ataraxia rewards — policy=${cfg.policy} share=${Number(cfg.shareBps) / 100}% threshold=${usd(BigInt(cfg.minPayoutAtomic))}`);
  console.log(`rewards wallet : ${cfg.rewardsAddress}`);
  console.log(`gross revenue   : ${usd(r.gross)}  (${r.payers} payer wallet(s))`);
  console.log(`pool accrued    : ${usd(r.pool)}  (25% of gross)`);
  console.log(`already paid out: ${usd(r.alreadySentTotal)}`);
  console.log(`awaiting payout : ${usd(r.awaiting)}`);
  console.log(`wallet on-chain : ${r.walletBalance == null ? '(unreadable / offline)' : `${formatUnits(r.walletBalance, 6)} USDC`}`);
  console.log('──────────────────────────────────────────────');
  if (!r.plan.length) {
    console.log('no address is above the payout threshold yet');
  } else {
    console.log(`plan (${r.plan.length} transfer(s), total ${usd(r.planTotal)}):`);
    for (const p of r.plan) console.log(`  ${p.address}  ${usd(p.accrued)}`);
  }
  if (r.skipped) console.log(`held back: ${r.skipped} wallet(s) below threshold / over the batch cap`);
  console.log('──────────────────────────────────────────────');
}
