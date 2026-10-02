#!/usr/bin/env node
// Real-chain test of Ataraxia's payment verifier (server/payments.mjs).
//
// It replays ACTUAL Base mainnet transactions that already exist (the payer wallet
// 0x85FC53D6… paying the Ataraxia/treasury wallet) and checks that verifyUsdcPayment
// accepts exactly the right ones. No money is spent: these are historical receipts.
//
// Run: node /home/ubuntu/ataraxia/ataraxia-react/server/test/verify-real-tx.mjs
import { createPublicClient, http, getAddress } from 'viem';
import { base } from 'viem/chains';
import { verifyUsdcPayment, USDC_BASE } from '../payments.mjs';

const PAY_TO = '0x6cb53f00a586f7704e1f7121c2e397b579eb3ed0'; // Ataraxia payTo (treasury)
const PAYER = '0x85FC53D6A89BF64E563588efc37b12ee89c4e421';  // wallet that actually paid
const OTHER = '0x3726570F9F73a7dB7437fEE42C8B4887A59E1dcC';  // a wallet that did NOT pay

const RPC = process.env.ATARAXIA_RPC || 'https://mainnet.base.org';
const client = createPublicClient({ chain: base, transport: http(RPC, { timeout: 30000 }) });

// historical, on-chain: payer -> treasury, amounts in atomic USDC
const TXS = {
  paid_0_03: '0x362df8f40c081af5f72c647fc10ca557dd2cd848be0096f7a87bd7f2f55ef1ed',
  paid_0_25: '0xb05bd66853a616eca70f45f951ed8b00f53162e64170c9b33181e0a8e15e947d',
};

let failures = 0;
const check = (name, cond, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!cond) failures += 1;
};

const call = (txHash, amountAtomic, payer) =>
  verifyUsdcPayment({ client, txHash, payTo: PAY_TO, amountAtomic, payer, token: USDC_BASE, minConfirmations: 1 });

// 1. the real 0.03 payment, asked for 0.03 -> accepted, amount read from the log
let r = await call(TXS.paid_0_03, '30000', PAYER);
check('real 0.03 tx accepted for a 0.03 invoice', r.ok === true, JSON.stringify(r).slice(0, 120));
check('amount comes from the Transfer log (30000 atomic)', r.amountAtomic === '30000', r.amountAtomic);
check('confirmations counted from the chain head', Number(r.confirmations) >= 1, `conf=${r.confirmations}`);

// 2. the SAME tx offered for the Cinema price (0.1) -> must be REFUSED (underpaid)
r = await call(TXS.paid_0_03, '100000', PAYER);
check('underpaid: 0.03 tx refused for a 0.1 video', r.ok === false && r.reason === 'no_matching_usdc_transfer', r.reason);

// 3. a bigger real payment (0.25) satisfies a 0.1 invoice -> accepted
r = await call(TXS.paid_0_25, '100000', PAYER);
check('overpayment accepted: 0.25 tx unlocks a 0.1 video', r.ok === true, r.amountAtomic);

// 4. an address that never paid cannot claim the tx
r = await call(TXS.paid_0_03, '30000', OTHER);
check('another wallet cannot claim someone else’s tx', r.ok === false && r.reason === 'no_matching_usdc_transfer', r.reason);

// 5. malformed input is refused, never thrown
r = await call('0xnot-a-hash', '30000', PAYER);
check('bad tx hash refused cleanly', r.ok === false && r.reason === 'bad_tx_hash', r.reason);
r = await call(TXS.paid_0_03, '0', PAYER);
check('zero amount refused', r.ok === false && r.reason === 'bad_amount', r.reason);
r = await call('0x' + '11'.repeat(32), '30000', PAYER);
check('unknown tx refused as tx_not_found', r.ok === false && r.reason === 'tx_not_found', r.reason);

console.log(failures === 0 ? '\nALL REAL-CHAIN VERIFIER CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
