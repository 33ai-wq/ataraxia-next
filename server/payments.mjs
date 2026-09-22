// Ataraxia — USDC payment verification (Base).
// Pure-ish helpers so the matching logic can be unit-tested with a stubbed client.
import { isAddress, getAddress } from 'viem';

export const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
export const BASE_CHAIN_ID = 8453;
// keccak256("Transfer(address,address,uint256)")
export const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

/** 32-byte topic -> checksummed address (last 20 bytes). */
export function topicToAddress(topic) {
  if (typeof topic !== 'string' || topic.length < 66) return null;
  try {
    return getAddress('0x' + topic.slice(-40));
  } catch {
    return null;
  }
}

/**
 * Verify a Base USDC payment against an invoice.
 *
 * Accepts a payment only when a receipt exists, succeeded, is confirmed, and
 * contains an ERC-20 Transfer log for `token` where from = `payer` (the SIWE
 * session address), to = `payTo`, with value >= `amountAtomic`.
 *
 * The log filter (not tx.from) is the source of truth so ERC-4337 / Base
 * Account smart wallets work: there the tx sender is a bundler, while the
 * Transfer log carries the smart-wallet address as `from`.
 *
 * @returns {Promise<{ok:boolean, reason?:string, amountAtomic?:string,
 *   blockNumber?:number, confirmations?:number, logIndex?:number}>}
 */
export async function verifyUsdcPayment({
  client,
  txHash,
  payTo,
  amountAtomic,
  payer,
  token = USDC_BASE,
  minConfirmations = 1,
}) {
  const fail = (reason, extra = {}) => ({ ok: false, reason, ...extra });

  if (typeof txHash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) return fail('bad_tx_hash');
  if (!isAddress(payTo)) return fail('bad_pay_to');
  if (!isAddress(payer)) return fail('bad_payer');
  let amount;
  try {
    amount = BigInt(amountAtomic);
  } catch {
    return fail('bad_amount');
  }
  if (amount <= 0n) return fail('bad_amount');

  let receipt;
  try {
    receipt = await client.getTransactionReceipt({ hash: txHash });
  } catch (e) {
    return fail('tx_not_found', { detail: String(e?.shortMessage || e?.message || e) });
  }
  if (!receipt) return fail('tx_not_found');
  if (receipt.status !== 'success') return fail('tx_failed');

  // Confirmations: prefer head - blockNumber + 1 (viem receipts may omit
  // `confirmations`); fall back to the receipt field when the head is unknown.
  let head = null;
  if (typeof client.getBlockNumber === 'function') {
    try {
      head = Number(await client.getBlockNumber());
    } catch {
      head = null;
    }
  }
  const blockNumber = Number(receipt.blockNumber ?? 0);
  const confirmations = head != null && blockNumber > 0
    ? Math.max(0, head - blockNumber + 1)
    : Number(receipt.confirmations ?? 0);
  if (confirmations < minConfirmations) {
    return fail('not_confirmed', { confirmations, blockNumber });
  }

  const wantToken = getAddress(token);
  const wantTo = getAddress(payTo);
  const wantFrom = getAddress(payer);

  const logs = Array.isArray(receipt.logs) ? receipt.logs : [];
  const transfers = logs.filter((l) => {
    if (!l?.address || !Array.isArray(l.topics) || l.topics.length < 3) return false;
    let addr;
    try {
      addr = getAddress(l.address);
    } catch {
      return false;
    }
    return addr === wantToken && String(l.topics[0]).toLowerCase() === TRANSFER_TOPIC;
  });

  const match = transfers.find((l) => {
    const from = topicToAddress(l.topics[1]);
    const to = topicToAddress(l.topics[2]);
    if (from !== wantFrom || to !== wantTo) return false;
    try {
      return BigInt(l.data) >= amount;
    } catch {
      return false;
    }
  });

  if (!match) return fail('no_matching_usdc_transfer', { transfersSeen: transfers.length });

  return {
    ok: true,
    amountAtomic: BigInt(match.data).toString(),
    blockNumber,
    confirmations,
    logIndex: Number(match.logIndex ?? 0),
  };
}
