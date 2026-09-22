// Shared Base RPC transport with automatic failover.
//
// Public endpoints (mainnet.base.org) rate-limit bursts, and a payment verifier
// that cannot read the chain simply cannot do its job — so we try an ordered
// list instead of a single URL. Configure in .env:
//   ATARAXIA_RPC=https://mainnet.base.org,https://base-rpc.publicnode.com,https://base.drpc.org
import { http, fallback } from 'viem';

/** Read lazily: callers may load .env into process.env after this module is imported. */
export function rpcList() {
  return (process.env.ATARAXIA_RPC || 'https://mainnet.base.org')
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean);
}

export function baseTransport() {
  const transports = rpcList().map((url) => http(url, { timeout: 12_000, retryCount: 1 }));
  if (transports.length === 1) return transports[0];
  return fallback(transports, { rank: false, retryCount: 1 });
}
