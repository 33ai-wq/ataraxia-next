// Base wallet helpers — SIWE sign-in message + USDC payment, both driven through
// the AppKit-owned wagmi config (so Builder Code attribution applies and
// smart-wallet / Base Account connectors work).
import { getAccount, switchChain, signMessage, sendTransaction, waitForTransactionReceipt, connect } from '@wagmi/core';
import { injected } from 'wagmi/connectors';
import { encodeFunctionData, concat } from 'viem';
import { wagmiConfig, BUILDER_DATA_SUFFIX } from '../components/WalletModal';

export const BASE_CHAIN_ID = 8453;
export const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
export const ERC20_TRANSFER_ABI = [
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
];

export const currentAccount = () => getAccount(wagmiConfig);

/** Make sure the session wallet is on Base (8453). */
export async function ensureBaseChain() {
  const acc = getAccount(wagmiConfig);
  if (!acc.address) throw new Error('No wallet connected for signing');
  if (Number(acc.chainId) !== BASE_CHAIN_ID) {
    await switchChain(wagmiConfig, { chainId: BASE_CHAIN_ID });
  }
}

/**
 * The app can hold a wallet connection that AppKit/wagmi does not know about
 * (e.g. the raw window.ethereum path for MetaMask). Payments and SIWE must run
 * on the wagmi config, so adopt the injected provider first when needed.
 *
 * Fail FAST when there is nothing to adopt: Base Account / passkey is an
 * explicit choice in the connect modal, never a silent 90s wait here.
 */
export async function adoptInjectedAccount(fallbackAddress = null) {
  const acc = getAccount(wagmiConfig);
  if (acc.address) return acc;
  if (typeof window !== 'undefined' && window.ethereum) {
    try {
      await connect(wagmiConfig, { connector: injected() });
    } catch { /* fall through to the explicit error below */ }
  }
  const next = getAccount(wagmiConfig);
  if (!next.address) {
    throw new Error(fallbackAddress
      ? 'This wallet is connected but not authorised for signing — reconnect with the Connect wallet button, then try again'
      : 'Connect a wallet first (Connect wallet button at the top), then unlock');
  }
  return next;
}

export function siweMessage(address, nonce) {
  return [
    'Sign in to Ataraxia',
    '',
    `address: ${address}`,
    `chainId: ${BASE_CHAIN_ID}`,
    `nonce: ${nonce}`,
    `issued: ${new Date().toISOString()}`,
    '',
    'Signing is free, moves no funds and only proves this wallet is yours.',
  ].join('\n');
}

/** Sign the SIWE message with whatever connector is active (EOA or smart wallet). */
export async function signSiwe(message) {
  const acc = getAccount(wagmiConfig);
  if (!acc.address) throw new Error('No wallet connected');
  return signMessage(wagmiConfig, { message, account: acc.address });
}

/**
 * Send an ERC-20 USDC transfer on Base and wait for one confirmation.
 *
 * Built by hand rather than with writeContract purely because Base Builder Code
 * attribution (ERC-8021) is a *data suffix*: viem supports `dataSuffix` but wagmi
 * v3 does not forward it, so we append the attribution bytes to the calldata
 * ourselves. Trailing bytes after a well-formed `transfer` call are ignored by
 * the token contract, and Base's indexer reads them to credit this app.
 */
export async function payUsdc({ to, amountAtomic }) {
  await ensureBaseChain();
  const acc = getAccount(wagmiConfig);
  if (!acc.address) throw new Error('No wallet connected');
  const calldata = encodeFunctionData({
    abi: ERC20_TRANSFER_ABI,
    functionName: 'transfer',
    args: [to, BigInt(amountAtomic)],
  });
  const data = BUILDER_DATA_SUFFIX ? concat([calldata, BUILDER_DATA_SUFFIX]) : calldata;
  const hash = await sendTransaction(wagmiConfig, {
    to: USDC_BASE,
    data,
    value: 0n,
    chainId: BASE_CHAIN_ID,
    account: acc.address,
  });
  const receipt = await waitForTransactionReceipt(wagmiConfig, { hash, confirmations: 1, timeout: 120_000 });
  return { hash, receipt, attributed: Boolean(BUILDER_DATA_SUFFIX) };
}

export const basescanTx = (hash) => `https://basescan.org/tx/${hash}`;
