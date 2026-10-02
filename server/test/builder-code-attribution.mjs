// Proves the Base Builder Code (ERC-8021) is really attached to the transaction
// the app asks the wallet to sign — without spending anything.
//
// How: a stub EIP-1193 provider records every request, and a session cookie is
// minted from the server's own HMAC secret so the app believes we are signed in
// and walks all the way to the USDC transfer. The tx is never broadcast.
//
//   node test/builder-code-attribution.mjs
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { Attribution } from 'ox/erc8021';

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER = join(HERE, '..');
const APP = process.env.E2E_BASE || 'https://ataraxia.xhagents.xyz';
const EXEC = process.env.CHROME_PATH || '/home/ubuntu/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';

// read the builder code the app was built with
const envFile = readFileSync(join(SERVER, '..', '.env'), 'utf8');
const BUILDER_CODE = (envFile.match(/VITE_BUILDER_CODE=(.+)/) || [])[1]?.trim();
const EXPECTED_SUFFIX = BUILDER_CODE ? Attribution.toDataSuffix({ codes: [BUILDER_CODE] }).slice(2).toLowerCase() : null;
const CODE_HEX = Buffer.from(BUILDER_CODE || '', 'utf8').toString('hex');

const PAYER = '0x1111111111111111111111111111111111111111';
const SECRET = readFileSync('/home/ubuntu/.ataraxia_session_secret', 'utf8').trim();
const now = Math.floor(Date.now() / 1000);
const b = Buffer.from(JSON.stringify({ address: PAYER, iat: now, exp: now + 3600 })).toString('base64url');
const sig = crypto.createHmac('sha256', SECRET).update(b).digest('base64url');
const SESSION = `${b}.${sig}`;

let failures = 0;
const check = (n, c, d = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${d ? `  (${d})` : ''}`); if (!c) failures += 1; };

console.log(`builder code : ${BUILDER_CODE}`);
console.log(`expects data : 0x${EXPECTED_SUFFIX}`);

const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 950 } });
await ctx.addCookies([{ name: 'ataraxia_sid', value: SESSION, domain: 'ataraxia.xhagents.xyz', path: '/', secure: true, httpOnly: true, sameSite: 'Lax' }]);

// Stub wallet: pretends to be an unlocked Base wallet and records what it is asked to do.
await ctx.addInitScript(`
  window.__asked = [];
  const ADDR = '${PAYER}';
  const chainHex = '0x2105';
  const respond = (method, params) => {
    switch (method) {
      case 'eth_requestAccounts':
      case 'eth_accounts': return [ADDR];
      case 'eth_chainId': return chainHex;
      case 'wallet_switchEthereumChain':
      case 'wallet_addEthereumChain': return null;
      case 'eth_blockNumber': return '0x1';
      case 'eth_getBlockByNumber': return { number: '0x1', baseFeePerGas: '0x3b9aca00', gasLimit: '0x1c9c380', timestamp: '0x1' };
      case 'eth_estimateGas': return '0x15000';
      case 'eth_gasPrice': return '0x3b9aca0';
      case 'eth_maxPriorityFeePerGas': return '0x3b9aca0';
      case 'eth_getTransactionCount': return '0x0';
      case 'eth_getBalance': return '0xde0b6b3a7640000';
      case 'eth_call': return '0x' + '0'.repeat(64);
      case 'eth_sendTransaction': return '0x' + 'ab'.repeat(32);
      case 'personal_sign':
      case 'eth_sign': return '0x' + 'cd'.repeat(65);
      case 'wallet_getCapabilities': return {};
      case 'wallet_sendCalls': return { id: '0x' + 'ef'.repeat(32) };
      default: return null;
    }
  };
  window.ethereum = {
    isMetaMask: true,
    request: async ({ method, params }) => {
      window.__asked.push({ method, params });
      return respond(method, params);
    },
    on: () => {}, removeListener: () => {}, off: () => {},
    _metamask: { isUnlocked: async () => true },
  };
`);

const page = await ctx.newPage();
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
page.on('pageerror', (e) => errs.push(`pageerror: ${String(e).slice(0, 160)}`));
page.on('response', (r) => { if (r.status() >= 400) errs.push(`HTTP ${r.status()} ${r.url().replace(APP, '').slice(0, 60)}`); });

await page.goto(APP, { waitUntil: 'networkidle', timeout: 60_000 });
await page.click('header nav button:has-text("Cinema")');
await page.waitForSelector('main .grid h3', { timeout: 20_000 });
await page.waitForTimeout(1200);

// Server-side truth: our minted session must be accepted (the browser is not signed
// in yet at this point — wagmi only adopts the wallet when the user acts).
const access = await (await fetch(`${APP}/api/access`, { headers: { Cookie: `ataraxia_sid=${SESSION}` } })).json();
check('minted session is accepted by the backend', access.authed === true && access.address === PAYER, `authed=${access.authed}`);

// Click unlock: invoice is opened, then wagmi asks the wallet to sign the transfer.
await page.click('main .grid button:has-text("Unlock")');
await page.waitForTimeout(9000);

const asked = await page.evaluate(() => window.__asked || []);
const sent = asked.filter((a) => a.method === 'eth_sendTransaction');
const calls = asked.filter((a) => a.method === 'wallet_sendCalls');
console.log('wallet requests seen:', asked.map((a) => a.method).join(', ') || '(none)');

const txParams = sent[0]?.params?.[0] || calls[0]?.params?.[0]?.calls?.[0];
check('the app asked the wallet to sign a transaction', Boolean(txParams), sent.length ? 'eth_sendTransaction' : calls.length ? 'wallet_sendCalls' : 'nothing');

if (txParams) {
  const data = String(txParams.data || txParams.callData || '').toLowerCase();
  check('the transaction is a USDC transfer', data.startsWith('0xa9059cbb'), data.slice(0, 12));
  check('calldata ends with the ERC-8021 marker', data.endsWith('80218021802180218021802180218021'), data.slice(-32));
  check('built with our Builder Code suffix', EXPECTED_SUFFIX ? data.endsWith(EXPECTED_SUFFIX) : false, `suffix=${data.slice(-EXPECTED_SUFFIX?.length || 0)}`);
  check('suffix carries the builder code bytes', data.includes(CODE_HEX), CODE_HEX);
  check('pays 0.1 USDC (100000 atomic)', /186a0$/.test(data.slice(0, 138)), data.slice(0, 138).slice(-20));
  check('recipient is the confirmed treasury', String(txParams.to).toLowerCase() === '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', String(txParams.to));
}

// 4xx from /api/* is the paywall doing its job (media 403 before unlock, etc.)
const gateHits = errs.filter((e) => /^HTTP 4\d\d \/api\//.test(e));
const hardErrs = errs.filter((e) => !/^HTTP 4\d\d \/api\//.test(e) && !/Failed to load resource.*status of 40[138]/.test(e));
console.log('gate responses seen:', gateHits.length ? gateHits.join(', ') : '(none)');
check('no unexpected console/network errors in the flow', hardErrs.length === 0, hardErrs[0] || 'clean');
await browser.close();
console.log(failures === 0 ? '\nBUILDER CODE ATTRIBUTION VERIFIED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
