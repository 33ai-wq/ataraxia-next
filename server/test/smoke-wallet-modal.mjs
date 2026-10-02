// Final verification: wallet modal + Base Account path + no uncaught errors.
import { chromium } from 'playwright-core';
const EXEC = '/home/ubuntu/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';
let failures = 0;
const check = (n, c, d = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${d ? `  (${d})` : ''}`); if (!c) failures++; };

const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1200, height: 950 } });
const page = await ctx.newPage();
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
page.on('pageerror', (e) => errs.push(`pageerror: ${String(e).slice(0, 160)}`));

await page.goto('https://ataraxia.xhagents.xyz/', { waitUntil: 'networkidle', timeout: 60_000 });
await page.click('header button:has-text("Connect wallet")');
await page.waitForTimeout(2500);

const modalText = await page.innerText('body');
check('Base Account (passkey · CDP) offered', /Base Account/.test(modalText) && /Passkey/.test(modalText));
check('existing injected wallets still offered', /MetaMask/.test(modalText) && /Coinbase Wallet/.test(modalText));
check('WalletConnect entry present', /WalletConnect/.test(modalText));

// WalletConnect pairing (the bug Boss saw)
await page.click('button:has-text("WalletConnect")');
await page.waitForTimeout(7000);
const qr = await page.locator('canvas, img[src^="data:image"]').count();
const wcText = await page.innerText('body');
check('WalletConnect renders a QR', qr >= 1, `${qr} canvas/img`);
check('WalletConnect offers a copyable link', /Salin tautan/i.test(wcText));
check('wallet directory loaded from explorer API', /BUKA LANGSUNG DI WALLET/.test(wcText), (wcText.match(/BUKA LANGSUNG DI WALLET \((\d+)\)/) || [])[0] || '');
check('no "on is not a function" pairing crash', !errs.some((e) => /is not a function/.test(e)), errs.find((e) => /is not a function/.test(e)) || 'clean');

// Base Account path: headless has no passkey, so expect a clear failure, not a crash
await page.click('button:has-text("← Semua wallet")').catch(() => {});
await page.waitForTimeout(800);
const baBtn = page.locator('button:has-text("Base Account")').first();
if (await baBtn.count()) {
  await baBtn.click();
  await page.waitForTimeout(9000);
}
const after = await page.innerText('body');
check('Base Account click does not throw an uncaught error', !errs.some((e) => e.startsWith('pageerror')), errs.find((e) => e.startsWith('pageerror')) || 'clean');
console.log('  state after Base Account click looks like:', after.split('\n').find((l) => /wallet|Base|connect|error|Passkey/i.test(l))?.slice(0, 100) || '(unchanged)');

console.log('\nconsole errors:', errs.length ? errs : '(none)');
check('no console errors in the modal flow', errs.length === 0);
await browser.close();
console.log(failures === 0 ? '\nALL MODAL CHECKS PASSED' : `\n${failures} MODAL CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
