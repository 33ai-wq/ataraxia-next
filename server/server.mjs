// Ataraxia backend (Base) — SIWE session + USDC pay-per-animation + gated media.
//
//   GET  /health
//   GET  /api/config                       -> chain/payTo/price (public, single source of truth)
//   GET  /api/catalog                      -> animation list (public metadata only)
//   GET  /api/nonce?address=0x...          -> { nonce, expiresIn }        SIWE nonce (5 min, single use)
//   POST /api/auth/verify {address,message,signature} -> httpOnly session cookie
//   GET  /api/session                      -> { authed, address }
//   POST /api/logout
//   GET  /api/access                       -> { address, unlocked:[videoId], credits:[] }
//   POST /api/pay/invoice {videoId}        -> { invoiceId, payTo, amountAtomic, token, chainId, expiresAt }
//   POST /api/pay/verify  {invoiceId,txHash} -> verifies the on-chain transfer, grants the unlock
//   GET  /api/media/:id                    -> 200 + X-Accel-Redirect (nginx streams) only if unlocked
//
// Money never moves here: the browser signs the USDC transfer, this service only
// proves the receipt matches the invoice (payer = session wallet, payee = treasury,
// amount >= price, token = USDC on Base) and then records the unlock.
import express from 'express';
import crypto from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, chmodSync, appendFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createPublicClient, isAddress } from 'viem';
import { base } from 'viem/chains';
import { baseTransport } from './rpc.mjs';
import { verifyUsdcPayment, USDC_BASE, BASE_CHAIN_ID } from './payments.mjs';
import { CATALOG, catalogById, publicCatalog, PRICE_ATOMIC, USDC_DECIMALS } from './catalog.mjs';
import { accrualFor, summarise, DEFAULT_SHARE_BPS, formatUsdc } from './rewards.mjs';

const PORT = Number(process.env.ATARAXIA_PORT || 3110);
const RPC = process.env.ATARAXIA_RPC || 'https://mainnet.base.org';
const PAY_TO = process.env.ATARAXIA_PAY_TO || '0x6cb53f00a586f7704e1f7121c2e397b579eb3ed0';
const MEDIA_DIR = process.env.ATARAXIA_MEDIA_DIR || '/home/ubuntu/ataraxia-media';
const DB_FILE = process.env.ATARAXIA_DB_FILE || '/home/ubuntu/ataraxia/server/ataraxia.db';
const AUDIT_LOG = process.env.ATARAXIA_AUDIT_LOG || '/home/ubuntu/ataraxia/server/unlocks.log';
const NONCE_TTL_MS = 5 * 60 * 1000;
const INVOICE_TTL_MS = 20 * 60 * 1000;
const SESSION_TTL_S = 7 * 24 * 3600;
const COOKIE_NAME = 'ataraxia_sid';
const SIGN_MARKER = 'Sign in to Ataraxia';
const MIN_CONFIRMATIONS = Number(process.env.ATARAXIA_MIN_CONFIRMATIONS || 1);

// ---- rewards (25% of verified revenue back to the payers) ----
// Accounting happens here; money only moves from the rewards wallet through
// scripts/pay_rewards.mjs, which is dry-run unless Boss's Sentinel ticket is supplied.
const REWARDS_ADDRESS = process.env.ATARAXIA_REWARDS_ADDRESS || '0x3726570F9F73a7dB7437fEE42C8B4887A59E1dcC';
const REWARDS_SHARE_BPS = BigInt(process.env.ATARAXIA_REWARDS_SHARE_BPS || DEFAULT_SHARE_BPS.toString());
const REWARDS_MIN_PAYOUT_ATOMIC = process.env.ATARAXIA_REWARDS_MIN_PAYOUT_ATOMIC || '50000'; // 0.05 USDC
const REWARDS_POLICY = process.env.ATARAXIA_REWARDS_POLICY || 'rebate'; // rebate | draw
if (!isAddress(REWARDS_ADDRESS)) {
  console.error(`[fatal] ATARAXIA_REWARDS_ADDRESS is not a valid address: ${REWARDS_ADDRESS}`);
  process.exit(1);
}
if (REWARDS_SHARE_BPS > 10000n) {
  console.error('[fatal] ATARAXIA_REWARDS_SHARE_BPS must be <= 10000');
  process.exit(1);
}

if (!isAddress(PAY_TO)) {
  console.error(`[fatal] ATARAXIA_PAY_TO is not a valid address: ${PAY_TO}`);
  process.exit(1);
}
if (!existsSync(MEDIA_DIR)) {
  console.error(`[fatal] media dir missing: ${MEDIA_DIR}`);
  process.exit(1);
}

// ---------- session secret (mode 600) ----------
function loadSecret() {
  const p = process.env.ATARAXIA_SESSION_SECRET_FILE || '/home/ubuntu/.ataraxia_session_secret';
  if (existsSync(p)) return readFileSync(p, 'utf8').trim();
  const s = crypto.randomBytes(32).toString('hex');
  writeFileSync(p, s, { mode: 0o600 });
  chmodSync(p, 0o600);
  return s;
}
const SECRET = loadSecret();

// ---------- viem public client (Base mainnet) ----------
// ordered failover list (public Base endpoints rate-limit bursts)
const client = createPublicClient({ chain: base, transport: baseTransport() });

// ---------- sqlite store ----------
const db = new DatabaseSync(DB_FILE);
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS invoices (
    id            TEXT PRIMARY KEY,
    address       TEXT NOT NULL,
    video_id      TEXT NOT NULL,
    amount_atomic TEXT NOT NULL,
    pay_to        TEXT NOT NULL,
    created_at    INTEGER NOT NULL,
    expires_at    INTEGER NOT NULL,
    tx_hash       TEXT,
    status        TEXT NOT NULL DEFAULT 'open'
  );
  CREATE INDEX IF NOT EXISTS invoices_addr ON invoices(address);
  CREATE TABLE IF NOT EXISTS unlocks (
    address       TEXT NOT NULL,
    video_id      TEXT NOT NULL,
    tx_hash       TEXT NOT NULL,
    amount_atomic TEXT NOT NULL,
    block_number  INTEGER,
    unlocked_at   INTEGER NOT NULL,
    PRIMARY KEY (address, video_id)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS unlocks_tx ON unlocks(tx_hash);
  CREATE TABLE IF NOT EXISTS rewards_ledger (
    tx_hash            TEXT PRIMARY KEY,
    address            TEXT NOT NULL,
    day                TEXT NOT NULL,
    amount_paid_atomic TEXT NOT NULL,
    accrued_atomic     TEXT NOT NULL,
    created_at         INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS rewards_ledger_addr ON rewards_ledger(address);
  CREATE TABLE IF NOT EXISTS rewards_payouts (
    id             TEXT PRIMARY KEY,
    address        TEXT NOT NULL,
    amount_atomic  TEXT NOT NULL,
    tx_hash        TEXT UNIQUE,
    status         TEXT NOT NULL,
    ticket         TEXT,
    created_at     INTEGER NOT NULL
  );
`);

const q = {
  insertInvoice: db.prepare(
    'INSERT INTO invoices (id,address,video_id,amount_atomic,pay_to,created_at,expires_at) VALUES (?,?,?,?,?,?,?)',
  ),
  getInvoice: db.prepare('SELECT * FROM invoices WHERE id = ?'),
  markInvoice: db.prepare('UPDATE invoices SET tx_hash = ?, status = ? WHERE id = ?'),
  openInvoiceCount: db.prepare(
    "SELECT COUNT(*) AS n FROM invoices WHERE address = ? AND status = 'open' AND expires_at > ?",
  ),
  insertUnlock: db.prepare(
    'INSERT INTO unlocks (address,video_id,tx_hash,amount_atomic,block_number,unlocked_at) VALUES (?,?,?,?,?,?)',
  ),
  getUnlock: db.prepare('SELECT * FROM unlocks WHERE address = ? AND video_id = ?'),
  unlockByTx: db.prepare('SELECT * FROM unlocks WHERE tx_hash = ?'),
  listUnlocks: db.prepare('SELECT video_id, tx_hash, amount_atomic, unlocked_at FROM unlocks WHERE address = ? ORDER BY unlocked_at DESC'),
  // ---- rewards ledger (accrual is derived from this table, no duplicate totals) ----
  ledgerInsert: db.prepare(
    'INSERT INTO rewards_ledger (tx_hash,address,day,amount_paid_atomic,accrued_atomic,created_at) VALUES (?,?,?,?,?,?)',
  ),
  ledgerByAddress: db.prepare('SELECT * FROM rewards_ledger WHERE address = ? ORDER BY created_at DESC LIMIT 200'),
  ledgerByDay: db.prepare('SELECT * FROM rewards_ledger WHERE day = ?'),
  ledgerAll: db.prepare('SELECT * FROM rewards_ledger'),
  payoutByAddress: db.prepare("SELECT COALESCE(SUM(CAST(amount_atomic AS INTEGER)),0) AS s FROM rewards_payouts WHERE status = 'sent' AND address = ?"),
  payoutTotal: db.prepare("SELECT COALESCE(SUM(CAST(amount_atomic AS INTEGER)),0) AS s FROM rewards_payouts WHERE status = 'sent'"),
  payoutsByAddress: db.prepare('SELECT * FROM rewards_payouts WHERE address = ? ORDER BY created_at DESC LIMIT 25'),
};

const utcDay = (ms = Date.now()) => new Date(ms).toISOString().slice(0, 10);

/**
 * Credit the payer's share of one verified payment. Idempotent per tx hash:
 * a replayed verify can never accrue twice.
 * Returns null when the row already existed.
 */
function creditReward({ txHash, address, paidAtomic, at = Date.now() }) {
  const hash = String(txHash).toLowerCase();
  const accrued = accrualFor(paidAtomic, REWARDS_SHARE_BPS);
  if (accrued <= 0n) return null;
  try {
    q.ledgerInsert.run(hash, address, utcDay(at), String(paidAtomic), accrued.toString(), at);
  } catch (e) {
    if (String(e.message || '').includes('UNIQUE')) return null; // already credited
    throw e;
  }
  return { accrued, day: utcDay(at) };
}

/** Accrued minus already-sent payouts for one address. */
function rewardsBalance(address) {
  const rows = q.ledgerByAddress.all(address);
  const paid = rows.reduce((s, r) => s + BigInt(r.amount_paid_atomic), 0n);
  const accrued = rows.reduce((s, r) => s + BigInt(r.accrued_atomic), 0n);
  const sent = BigInt(q.payoutByAddress.get(address).s);
  const remaining = accrued > sent ? accrued - sent : 0n;
  return { rows, paid, accrued, sent, remaining };
}

// ---------- SIWE session (HMAC, httpOnly cookie) ----------
const nonces = new Map(); // address(lower) -> { nonce, exp }
const b64 = (payload) => Buffer.from(JSON.stringify(payload)).toString('base64url');
const jwtSign = (payload) => {
  const b = b64(payload);
  return `${b}.${crypto.createHmac('sha256', SECRET).update(b).digest('base64url')}`;
};
const jwtVerify = (token) => {
  if (!token || !token.includes('.')) return null;
  const [b, sig] = token.split('.');
  const expect = crypto.createHmac('sha256', SECRET).update(b).digest('base64url');
  try {
    if (sig.length !== expect.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(expect), Buffer.from(sig))) return null;
  } catch {
    return null;
  }
  try {
    const p = JSON.parse(Buffer.from(b, 'base64url').toString('utf8'));
    if (p.exp && Date.now() / 1000 > p.exp) return null;
    return p;
  } catch {
    return null;
  }
};
const authSession = (req) => {
  const raw = req.headers.cookie || '';
  const m = raw.split(/;\s*/).find((c) => c.startsWith(`${COOKIE_NAME}=`));
  if (!m) return null;
  return jwtVerify(decodeURIComponent(m.slice(COOKIE_NAME.length + 1)));
};
const setSessionCookie = (res, payload) => {
  const token = jwtSign({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + SESSION_TTL_S });
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_S}; Secure`,
  );
  return token;
};

// ---------- tiny in-memory rate limiter ----------
const hits = new Map();
function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const rec = hits.get(key);
  if (!rec || now > rec.reset) {
    hits.set(key, { n: 1, reset: now + windowMs });
    return true;
  }
  rec.n += 1;
  return rec.n <= max;
}

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '64kb' }));
app.use((_req, res, next) => { res.setHeader('X-Ataraxia-Auth', 'v1'); next(); });

const requireSession = (req, res) => {
  const s = authSession(req);
  if (!s?.address) {
    res.status(401).json({ error: 'not_signed_in', message: 'Sign in with your wallet first' });
    return null;
  }
  return s.address.toLowerCase();
};

app.get('/health', (_req, res) => res.json({ ok: true, chain: 'base', chainId: BASE_CHAIN_ID, payTo: PAY_TO, mediaDir: MEDIA_DIR, items: CATALOG.length }));

app.get('/api/config', (_req, res) => res.json({
  chain: 'base',
  chainId: BASE_CHAIN_ID,
  usdc: USDC_BASE,
  usdcDecimals: USDC_DECIMALS,
  payTo: PAY_TO,
  priceAtomic: PRICE_ATOMIC.toString(),
  minConfirmations: MIN_CONFIRMATIONS,
}));

app.get('/api/catalog', (_req, res) => res.json({ items: publicCatalog() }));

app.get('/api/nonce', (req, res) => {
  const address = String(req.query.address || '').trim().toLowerCase();
  if (address && !isAddress(address)) return res.status(400).json({ error: 'invalid_address' });
  const key = address || `anon-${crypto.randomBytes(8).toString('hex')}`;
  const nonce = crypto.randomBytes(16).toString('hex');
  nonces.set(key, { nonce, exp: Date.now() + NONCE_TTL_MS });
  return res.json({ nonce, expiresIn: NONCE_TTL_MS, issuedAt: new Date().toISOString() });
});

app.post('/api/auth/verify', async (req, res) => {
  try {
    const { address, message, signature } = req.body || {};
    if (!isAddress(address)) return res.status(400).json({ error: 'missing_address' });
    if (!message || !signature) return res.status(400).json({ error: 'missing_message_or_signature' });
    if (!String(message).startsWith(SIGN_MARKER)) return res.status(400).json({ error: 'bad_message_format' });

    const key = String(address).toLowerCase();
    const stored = nonces.get(key);
    if (!stored) return res.status(401).json({ error: 'no_nonce', message: 'Request /api/nonce first' });
    if (Date.now() > stored.exp) { nonces.delete(key); return res.status(401).json({ error: 'nonce_expired' }); }
    if (!String(message).includes(stored.nonce)) return res.status(401).json({ error: 'nonce_mismatch' });

    const valid = await client.verifyMessage({ address, message, signature });
    if (!valid) return res.status(401).json({ error: 'invalid_signature' });

    nonces.delete(key);
    setSessionCookie(res, { address: key });
    return res.json({ ok: true, address: key });
  } catch (e) {
    console.error('[auth/verify]', e);
    return res.status(500).json({ error: 'verify_failed' });
  }
});

app.get('/api/session', (req, res) => {
  const s = authSession(req);
  if (!s?.address) return res.json({ authed: false });
  return res.json({ authed: true, address: s.address });
});

app.post('/api/logout', (_req, res) => {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  res.json({ ok: true });
});

app.get('/api/access', (req, res) => {
  const s = authSession(req);
  if (!s?.address) return res.json({ authed: false, address: null, unlocked: [] });
  const rows = q.listUnlocks.all(s.address);
  return res.json({
    authed: true,
    address: s.address,
    unlocked: rows.map((r) => r.video_id),
    items: rows,
  });
});

// 1) open an invoice for one animation
app.post('/api/pay/invoice', (req, res) => {
  const address = requireSession(req, res);
  if (!address) return;
  if (!rateLimit(`inv:${address}`, 20, 60_000)) return res.status(429).json({ error: 'rate_limited' });

  const { videoId } = req.body || {};
  const item = catalogById(String(videoId || ''));
  if (!item) return res.status(400).json({ error: 'unknown_video' });

  if (q.getUnlock.get(address, item.id)) {
    return res.json({ alreadyUnlocked: true, videoId: item.id });
  }

  const open = Number(q.openInvoiceCount.get(address, Date.now()).n);
  if (open > 10) return res.status(429).json({ error: 'too_many_open_invoices' });

  const id = crypto.randomUUID();
  const now = Date.now();
  const expiresAt = now + INVOICE_TTL_MS;
  q.insertInvoice.run(id, address, item.id, item.priceAtomic, PAY_TO, now, expiresAt);

  return res.json({
    invoiceId: id,
    videoId: item.id,
    chainId: BASE_CHAIN_ID,
    token: USDC_BASE,
    tokenDecimals: USDC_DECIMALS,
    payTo: PAY_TO,
    amountAtomic: item.priceAtomic,
    minConfirmations: MIN_CONFIRMATIONS,
    expiresAt,
  });
});

// 2) verify the transfer, then grant the unlock (idempotent per tx)
app.post('/api/pay/verify', async (req, res) => {
  const address = requireSession(req, res);
  if (!address) return;
  if (!rateLimit(`ver:${address}`, 60, 60_000)) return res.status(429).json({ error: 'rate_limited' });

  const { invoiceId, txHash } = req.body || {};
  const inv = q.getInvoice.get(String(invoiceId || ''));
  if (!inv) return res.status(400).json({ error: 'unknown_invoice' });
  if (inv.address !== address) return res.status(403).json({ error: 'invoice_not_yours' });
  if (inv.status === 'paid') {
    return res.json({ ok: true, alreadyUnlocked: true, videoId: inv.video_id, txHash: inv.tx_hash });
  }
  if (Date.now() > Number(inv.expires_at)) return res.status(400).json({ error: 'invoice_expired' });

  const result = await verifyUsdcPayment({
    client,
    txHash: String(txHash || ''),
    payTo: inv.pay_to,
    amountAtomic: inv.amount_atomic,
    payer: address,
    minConfirmations: MIN_CONFIRMATIONS,
  });

  if (!result.ok) {
    const pending = ['tx_not_found', 'not_confirmed'].includes(result.reason);
    return res.status(pending ? 202 : 400).json({ ok: false, reason: result.reason, confirmations: result.confirmations });
  }

  const existingTx = q.unlockByTx.get(String(txHash).toLowerCase());
  if (existingTx && !(existingTx.address === address && existingTx.video_id === inv.video_id)) {
    return res.status(409).json({ ok: false, reason: 'tx_already_used' });
  }

  try {
    q.insertUnlock.run(address, inv.video_id, String(txHash).toLowerCase(), result.amountAtomic, result.blockNumber, Date.now());
  } catch (e) {
    if (!String(e.message || '').includes('UNIQUE')) throw e;
  }
  q.markInvoice.run(String(txHash).toLowerCase(), 'paid', inv.id);

  try {
    appendFileSync(AUDIT_LOG, JSON.stringify({
      at: new Date().toISOString(), address, videoId: inv.video_id, txHash,
      amountAtomic: result.amountAtomic, blockNumber: result.blockNumber,
    }) + '\n');
  } catch (e) {
    console.error('[audit]', e.message);
  }

  console.log(`[unlock] ${address} -> ${inv.video_id} (${result.amountAtomic} atomic) tx=${txHash}`);
  const credited = creditReward({ txHash, address, paidAtomic: result.amountAtomic });
  if (credited) {
    console.log(`[rewards] +${credited.accrued} atomic -> ${address} (${credited.day})`);
  }
  return res.json({
    ok: true,
    videoId: inv.video_id,
    txHash: String(txHash).toLowerCase(),
    amountAtomic: result.amountAtomic,
    blockNumber: result.blockNumber,
    explorer: `https://basescan.org/tx/${txHash}`,
    rewardAccruedAtomic: credited ? credited.accrued.toString() : '0',
  });
});

// 3) gated media: cookie session + recorded unlock, then let nginx stream the file
app.get('/api/media/:id', (req, res) => {
  const address = requireSession(req, res);
  if (!address) return;
  const item = catalogById(String(req.params.id || ''));
  if (!item) return res.status(404).json({ error: 'unknown_video' });
  if (!q.getUnlock.get(address, item.id)) {
    return res.status(403).json({ error: 'not_unlocked', videoId: item.id });
  }
  const abs = `${MEDIA_DIR}/${item.file}`;
  if (!existsSync(abs)) return res.status(500).json({ error: 'media_missing' });
  res.setHeader('X-Accel-Redirect', `/media/${encodeURIComponent(item.file)}`);
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.setHeader('Content-Disposition', 'inline');
  return res.status(200).end();
});

// 4) rewards: what this wallet has earned back, and how the pool stands today
app.get('/api/rewards', (req, res) => {
  const s = authSession(req);
  if (!s?.address) {
    return res.json({ authed: false, share: Number(REWARDS_SHARE_BPS) / 10000, policy: REWARDS_POLICY });
  }
  const address = s.address;
  const { rows, paid, accrued, sent, remaining } = rewardsBalance(address);
  const todayRows = q.ledgerByDay.all(utcDay());
  const todayPool = todayRows.reduce((sum, r) => sum + BigInt(r.accrued_atomic), 0n);
  const todayGross = todayRows.reduce((sum, r) => sum + BigInt(r.amount_paid_atomic), 0n);
  const todayPayers = new Set(todayRows.map((r) => r.address)).size;
  return res.json({
    authed: true,
    address,
    share: Number(REWARDS_SHARE_BPS) / 10000,
    shareBps: Number(REWARDS_SHARE_BPS),
    policy: REWARDS_POLICY,
    minPayoutAtomic: REWARDS_MIN_PAYOUT_ATOMIC,
    rewardsAddress: REWARDS_ADDRESS,
    me: {
      payments: rows.length,
      paidAtomic: paid.toString(),
      accruedAtomic: accrued.toString(),
      sentAtomic: sent.toString(),
      remainingAtomic: remaining.toString(),
      eligible: remaining >= BigInt(REWARDS_MIN_PAYOUT_ATOMIC),
    },
    today: {
      day: utcDay(),
      grossAtomic: todayGross.toString(),
      poolAtomic: todayPool.toString(),
      payers: todayPayers,
      yourShareAtomic: todayRows
        .filter((r) => r.address === address)
        .reduce((sum, r) => sum + BigInt(r.accrued_atomic), 0n)
        .toString(),
    },
    payouts: q.payoutsByAddress.all(address).map((p) => ({
      amountAtomic: p.amount_atomic,
      txHash: p.tx_hash,
      status: p.status,
      createdAt: p.created_at,
      explorer: p.tx_hash ? `https://basescan.org/tx/${p.tx_hash}` : null,
    })),
    ledger: rows.slice(0, 20).map((r) => ({
      txHash: r.tx_hash,
      day: r.day,
      paidAtomic: r.amount_paid_atomic,
      accruedAtomic: r.accrued_atomic,
      explorer: `https://basescan.org/tx/${r.tx_hash}`,
    })),
  });
});

// 5) public rewards snapshot (no addresses) — the Cinema/Rewards page shows the pool honestly
app.get('/api/rewards/public', (_req, res) => {
  const all = q.ledgerAll.all();
  const s = summarise(all);
  const sent = BigInt(q.payoutTotal.get().s);
  const todayRows = q.ledgerByDay.all(utcDay());
  return res.json({
    share: Number(REWARDS_SHARE_BPS) / 10000,
    policy: REWARDS_POLICY,
    minPayoutAtomic: REWARDS_MIN_PAYOUT_ATOMIC,
    rewardsAddress: REWARDS_ADDRESS,
    today: {
      day: utcDay(),
      poolAtomic: todayRows.reduce((x, r) => x + BigInt(r.accrued_atomic), 0n).toString(),
      payers: new Set(todayRows.map((r) => r.address)).size,
    },
    allTime: {
      poolAtomic: s.pool.toString(),
      payers: s.payers,
      paidOutAtomic: sent.toString(),
      awaitingPayoutAtomic: (s.pool > sent ? s.pool - sent : 0n).toString(),
      poolUsdc: formatUsdc(s.pool),
    },
  });
});

app.listen(PORT, () => {
  console.log(`ataraxia-backend :${PORT} chain=base payTo=${PAY_TO} media=${MEDIA_DIR} items=${CATALOG.length}`);
});
