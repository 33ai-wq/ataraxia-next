/**
 * src/lib/hedera.js
 * Hedera Testnet monetization utilities for Ataraxia
 * 
 * Uses account 0.0.4865075 (EVM: 0x510b8dae2b74ab45adb77024c6d424cab8265681)
 * 1900 testnet HBAR available
 * Mirror Node: https://testnet.mirrornode.hedera.com
 */

import { Client, AccountId, PrivateKey, TransferTransaction, Hbar, TokenMintTransaction, TokenId, TokenAssociateTransaction } from "@hashgraph/sdk";

const MIRROR_NODE = "https://testnet.mirrornode.hedera.com";
const TREASURY_ACCOUNT_ID = "0.0.4865075"; // Boss's testnet account
const HTS_REWARD_TOKEN_ID = "0.0.XXXXXX"; // TODO: Create HTS token for rewards, update this

// Create Hedera client for testnet
function createClient(operatorAccountId = TREASURY_ACCOUNT_ID) {
  const client = Client.forTestnet();
  client.setOperator(AccountId.fromString(operatorAccountId), PrivateKey.fromStringECDSA(process.env.HEDERA_OPERATOR_PRIVATE_KEY || ""));
  return client;
}

// Check if account exists and has balance via Mirror Node
export async function checkAccountBalance(accountId) {
  try {
    const response = await fetch(`${MIRROR_NODE}/api/v1/accounts/${accountId}`);
    if (!response.ok) throw new Error(`Mirror Node error: ${response.status}`);
    const data = await response.json();
    return {
      balance: data.balance?.balance || 0, // tinybars
      tokens: data.tokens || []
    };
  } catch (error) {
    console.error('[Hedera] Balance check failed:', error);
    return { balance: 0, tokens: [] };
  }
}

// Verify transaction via Mirror Node
export async function verifyTransaction(transactionId) {
  try {
    const response = await fetch(`${MIRROR_NODE}/api/v1/transactions/${transactionId}`);
    if (!response.ok) return { success: false, error: `Mirror Node: ${response.status}` };
    const data = await response.json();
    return { 
      success: true, 
      status: data.transactions?.[0]?.result,
      consensusTimestamp: data.transactions?.[0]?.consensus_timestamp,
      transactionId: data.transactions?.[0]?.transaction_id
    };
  } catch (error) {
    console.error('[Hedera] Transaction verification failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * sendPracticeReward — Mint/transfer HTS reward token to user on achievement/level-up
 * Called from useAtaraxiaStore.ts when checkAchievements detects new achievement
 * 
 * @param {string} accountId - User's Hedera account ID (e.g., "0.0.123456")
 * @param {number} amount - Amount of reward token (default: 1)
 * @returns {Promise<{success: boolean, transactionId?: string, error?: string}>}
 */
export async function sendPracticeReward(accountId, amount = 1) {
  try {
    const client = createClient();
    
    // Associate token with user account if needed (first time only)
    const associateTx = await new TokenAssociateTransaction()
      .setAccountId(AccountId.fromString(accountId))
      .setTokenIds([TokenId.fromString(HTS_REWARD_TOKEN_ID)])
      .execute(client);
    await associateTx.getReceipt(client);
    
    // Mint reward token to user
    const mintTx = await new TokenMintTransaction()
      .setTokenId(TokenId.fromString(HTS_REWARD_TOKEN_ID))
      .setAmount(amount)
      .execute(client);
    const receipt = await mintTx.getReceipt(client);
    
    const transactionId = mintTx.transactionId.toString();
    console.log(`[Hedera] Reward minted: ${transactionId} to ${accountId}`);
    
    // Verify via Mirror Node
    const verification = await verifyTransaction(transactionId);
    
    return {
      success: true,
      transactionId,
      verified: verification.success
    };
  } catch (error) {
    console.error('[Hedera] sendPracticeReward failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * payForUnlock — Transfer HBAR from user to treasury for premium unlock
 * User signs via WalletConnect, we submit TransactionTransaction
 * 
 * @param {string} accountId - User's Hedera account ID
 * @param {string} itemId - Premium item identifier (e.g., "soundscape_pack_1", "theme_custom", "pattern_custom")
 * @param {number} hbarAmount - Amount in HBAR (e.g., 0.5 = 500000000 tinybars)
 * @returns {Promise<{success: boolean, transactionId?: string, error?: string}>}
 */
export async function payForUnlock(accountId, itemId, hbarAmount) {
  try {
    const client = createClient(accountId); // User as operator (they sign)
    
    // Define treasury (different from Base/Solana treasury)
    const treasuryAccountId = AccountId.fromString(TREASURY_ACCOUNT_ID);
    
    // Create HBAR transfer: user -> treasury
    const transferTx = await new TransferTransaction()
      .addHbarTransfer(AccountId.fromString(accountId), new Hbar(-hbarAmount)) // negative = sending
      .addHbarTransfer(treasuryAccountId, new Hbar(hbarAmount)) // positive = receiving
      .setTransactionMemo(`Ataraxia unlock: ${itemId}`)
      .execute(client);
    
    const receipt = await transferTx.getReceipt(client);
    const transactionId = transferTx.transactionId.toString();
    
    console.log(`[Hedera] Unlock payment: ${transactionId} | ${itemId} | ${hbarAmount} HBAR`);
    
    // Verify via Mirror Node
    const verification = await verifyTransaction(transactionId);
    
    return {
      success: true,
      transactionId,
      itemId,
      hbarAmount,
      verified: verification.success
    };
  } catch (error) {
    console.error('[Hedera] payForUnlock failed:', error);
    return { success: false, error: error.message };
  }
}

// Premium items catalog (micro prices)
export const PREMIUM_ITEMS = {
  soundscape_pack_1: { name: "Soundscape Pack: Rain + Wind + Bowls", hbar: 0.1, usd: 0.005 },
  soundscape_pack_2: { name: "Soundscape Pack: Ocean + Forest + Fire", hbar: 0.1, usd: 0.005 },
  theme_zen_garden: { name: "Custom Zen Garden Theme", hbar: 0.15, usd: 0.008 },
  theme_minimalist: { name: "Minimalist Dark Theme", hbar: 0.1, usd: 0.005 },
  pattern_custom: { name: "Custom Breathing Pattern Creator", hbar: 0.2, usd: 0.01 },
  profile_avatar_nft: { name: "Profile Avatar NFT Badge", hbar: 0.5, usd: 0.025 },
};

// Get item price
export function getPremiumItem(itemId) {
  return PREMIUM_ITEMS[itemId] || null;
}

// Convert HBAR to tinybars
export function hbarToTinybars(hbar) {
  return Math.round(hbar * 100000000);
}

// Convert tinybars to HBAR
export function tinybarsToHbar(tinybars) {
  return tinybars / 100000000;
}