// Ataraxia wallet-auth backend — SIWE-style nonce + verifyMessage (ERC-6492 aware) + session JWT.
// ENDPOINTS
//   GET  /api/nonce?address=0x...            -> { nonce, expiresIn }   (nonce disimpan per-address, sekali pakai, 5 menit)
//   POST /api/auth/verify {address,message,signature} -> set httpOnly session cookie; return { ok, address }
//   GET  /api/session                          -> { authed, address }   (cek session cookie)
//   POST /api/tx                               -> session-gated; stub utk transaksi 0.1 USDC (BELUM gerakkan dana nyata)
//   GET  /health                                -> { ok, chain }
import express from 'express';
import crypto from 'node:crypto';
import { readFileSync, existsSync, writeFileSync, chmodSync } from 'node:fs';
import { createPublicClient, http, isAddress } from 'viem';
import { base } from 'viem/chains';

const PORT = process.env.ATARAXIA_PORT || 3110;
const NONCE_TTL_MS = 5 * 60 * 1000;       // 5 menit
const SESSION_TTL_S = 7 * 24 * 3600;      // 7 hari
const COOKIE_NAME = 'ataraxia_sid';
const RPC = process.env.ATARAXIA_RPC || 'https://mainnet.base.org';
const SIGN_MARKER = 'Sign in to Ataraxia';

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
const client = createPublicClient({ chain: base, transport: http(RPC) });

// ---------- in-memory nonce + session stores ----------
const nonces = new Map();   // address(lower) -> { nonce, exp }
const jwtSign = (payload) => {
  const b = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(b).digest('base64url');
  return `${b}.${sig}`;
};
const jwtVerify = (token) => {
  if (!token || !token.includes('.')) return null;
  const [b, sig] = token.split('.');
  const expect = crypto.createHmac('sha256', SECRET).update(b).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(expect), Buffer.from(sig))) return null;
  try {
    const p = JSON.parse(Buffer.from(b, 'base64url').toString('utf8'));
    if (p.exp && Date.now() / 1000 > p.exp) return null;
    return p;
  } catch { return null; }
};
const authSession = (req) => {
  const raw = req.headers.cookie || '';
  const m = raw.split(/;\s*/).find((c) => c.startsWith(`${COOKIE_NAME}=`));
  if (!m) return null;
  return jwtVerify(decodeURIComponent(m.slice(COOKIE_NAME.length + 1)));
};
const setSessionCookie = (res, payload) => {
  const token = jwtSign({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + SESSION_TTL_S });
  res.setHeader('Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_S}${PORT === 3110 && process.env.ATARAXIA_INSECURE_COOKIE ? '' : '; Secure'}`);
  return token;
};

const app = express();
app.use(express.json({ limit: '64kb' }));

// dev/standalone CORS (di belakang nginx proxy same-origin, CORS tidak dipakai; default kosong/off)
app.use((req, res, next) => { res.setHeader('X-Ataraxia-Auth', 'v1'); next(); });

app.get('/health', (_req, res) => res.json({ ok: true, chain: 'base' }));

// 1) nonce
app.get('/api/nonce', (req, res) => {
  const address = (req.query.address || '').trim().toLowerCase();
  if (address && !isAddress(address)) {
    return res.status(400).json({ error: 'invalid_address' });
  }
  const key = address || `anon-${crypto.randomBytes(8).toString('hex')}`;
  const nonce = crypto.randomBytes(16).toString('hex');
  nonces.set(key, { nonce, exp: Date.now() + NONCE_TTL_MS });
  return res.json({ nonce, expiresIn: NONCE_TTL_MS });
});

// 2) verify (viem verifyMessage, ERC-6492-aware)
app.post('/api/auth/verify', async (req, res) => {
  try {
    const { address, message, signature } = req.body || {};
    if (!isAddress(address)) return res.status(400).json({ error: 'missing_address' });
    if (!message || !signature) return res.status(400).json({ error: 'missing_message_or_signature' });
    if (!message.startsWith(SIGN_MARKER)) return res.status(400).json({ error: 'bad_message_format' });

    const key = address.toLowerCase();
    const stored = nonces.get(key);
    if (!stored) return res.status(401).json({ error: 'no_nonce', message: 'No active nonce for this address — request /api/nonce first' });
    if (Date.now() > stored.exp) { nonces.delete(key); return res.status(401).json({ error: 'nonce_expired' }); }
    // pastikan nonce ikut di-pesan
    if (!message.includes(stored.nonce)) return res.status(401).json({ error: 'nonce_mismatch' });

    const valid = await client.verifyMessage({ address, message, signature });
    if (!valid) return res.status(401).json({ error: 'invalid_signature' });

    nonces.delete(key); // sekali pakai
    setSessionCookie(res, { address: address.toLowerCase() });
    return res.json({ ok: true, address: address.toLowerCase() });
  } catch (e) {
    console.error('[verify]', e);
    return res.status(500).json({ error: 'verify_failed' });
  }
});

// 3) session check
app.get('/api/session', (req, res) => {
  const s = authSession(req);
  if (!s) return res.json({ authed: false });
  return res.json({ authed: true, address: s.address });
});

// 4) session-gated 0.1 USDC tx (STUB — belum gerakkan dana nyata)
app.post('/api/tx', (req, res) => {
  const s = authSession(req);
  if (!s) return res.status(401).json({ error: 'unauthorized', message: 'Valid session required' });
  return res.json({
    authorized: true,
    address: s.address,
    amountUsdc: 0.1,
    note: 'Session valid — tx allowed. Real funds movement pending mechanism confirmation.',
  });
});

// 5) signout
app.post('/api/logout', (_req, res) => {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`ataraxia-auth listening :${PORT} chain=base`));