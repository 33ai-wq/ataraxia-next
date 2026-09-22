// Unit tests for the USDC verification logic (stubbed RPC client — no network).
// Run: node --test /home/ubuntu/ataraxia/server/test/
import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyUsdcPayment, USDC_BASE, TRANSFER_TOPIC } from '../payments.mjs';

const PAY_TO = '0x6cb53f00a586f7704e1f7121c2e397b579eb3ed0';
const PAYER = '0x1111111111111111111111111111111111111111';
const OTHER = '0x2222222222222222222222222222222222222222';
const TX = '0x' + 'ab'.repeat(32);
const AMOUNT = 100000n; // 0.1 USDC

const pad = (addr) => '0x' + addr.slice(2).toLowerCase().padStart(64, '0');
const amountHex = (v) => '0x' + BigInt(v).toString(16).padStart(64, '0');

function transferLog({ token = USDC_BASE, from = PAYER, to = PAY_TO, value = AMOUNT } = {}) {
  return { address: token, topics: [TRANSFER_TOPIC, pad(from), pad(to)], data: amountHex(value), logIndex: 7 };
}

function stubClient({ logs = [transferLog()], status = 'success', blockNumber = 100, head = 100 } = {}) {
  return {
    async getTransactionReceipt() {
      return { status, blockNumber: BigInt(blockNumber), logs };
    },
    async getBlockNumber() {
      return BigInt(head);
    },
  };
}

const base = { client: stubClient(), txHash: TX, payTo: PAY_TO, amountAtomic: AMOUNT, payer: PAYER };

test('accepts a matching USDC transfer and reports the on-chain amount', async () => {
  const r = await verifyUsdcPayment(base);
  assert.equal(r.ok, true);
  assert.equal(r.amountAtomic, '100000');
  assert.equal(r.blockNumber, 100);
  assert.equal(r.confirmations, 1);
});

test('accepts overpayment', async () => {
  const client = stubClient({ logs: [transferLog({ value: 250000n })] });
  const r = await verifyUsdcPayment({ ...base, client });
  assert.equal(r.ok, true);
  assert.equal(r.amountAtomic, '250000');
});

test('rejects underpayment', async () => {
  const client = stubClient({ logs: [transferLog({ value: 99999n })] });
  const r = await verifyUsdcPayment({ ...base, client });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no_matching_usdc_transfer');
});

test('rejects payment to a different recipient', async () => {
  const client = stubClient({ logs: [transferLog({ to: OTHER })] });
  const r = await verifyUsdcPayment({ ...base, client });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no_matching_usdc_transfer');
});

test('rejects a transfer sent by someone else (payer must be the session wallet)', async () => {
  const client = stubClient({ logs: [transferLog({ from: OTHER })] });
  const r = await verifyUsdcPayment({ ...base, client });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no_matching_usdc_transfer');
});

test('rejects a fake token contract that mimics the Transfer event', async () => {
  const client = stubClient({ logs: [transferLog({ token: OTHER })] });
  const r = await verifyUsdcPayment({ ...base, client });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no_matching_usdc_transfer');
});

test('rejects a failed transaction', async () => {
  const client = stubClient({ status: 'reverted' });
  const r = await verifyUsdcPayment({ ...base, client });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'tx_failed');
});

test('reports not_confirmed when the block is too fresh', async () => {
  const client = stubClient({ head: 100, blockNumber: 100 });
  const r = await verifyUsdcPayment({ ...base, client, minConfirmations: 2 });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'not_confirmed');
  assert.equal(r.confirmations, 1);
});

test('reports tx_not_found when the receipt does not exist yet', async () => {
  const client = { async getTransactionReceipt() { throw new Error('TransactionReceiptNotFoundError'); }, async getBlockNumber() { return 1n; } };
  const r = await verifyUsdcPayment({ ...base, client });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'tx_not_found');
});

test('rejects malformed inputs before touching the chain', async () => {
  assert.equal((await verifyUsdcPayment({ ...base, txHash: '0xdeadbeef' })).reason, 'bad_tx_hash');
  assert.equal((await verifyUsdcPayment({ ...base, payTo: 'not-an-address' })).reason, 'bad_pay_to');
  assert.equal((await verifyUsdcPayment({ ...base, payer: 'nope' })).reason, 'bad_payer');
  assert.equal((await verifyUsdcPayment({ ...base, amountAtomic: 0 })).reason, 'bad_amount');
});

test('accepts a smart-wallet transfer whose tx sender is a bundler (log.from is the payer)', async () => {
  // tx.from would be the bundler; only the Transfer log identifies the payer,
  // which is what the implementation keys on.
  const r = await verifyUsdcPayment({ ...base, client: stubClient() });
  assert.equal(r.ok, true);
});
