// Real-browser smoke test of the refactored Ataraxia (Playwright, headless).
// Verifies: app renders, nav works, Cinema lists the catalogue, previews are
// poster-first, the paywall button and price are present, and no console error
// / failed request happens on the way.
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const EXEC = '/home/ubuntu/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';
const BASE = 'https://ataraxia.xhagents.xyz/';

const errors = [];
const failed = [];
let failures = 0;
const check = (name, cond, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!cond) failures += 1;
};

const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
page.on('pageerror', (e) => errors.push(`pageerror: ${String(e).slice(0, 200)}`));
page.on('requestfailed', (r) => failed.push(`${r.method()} ${r.resourceType()} ${r.url().slice(0, 110)} :: ${r.failure()?.errorText}`));

await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60_000 });
check('title', (await page.title()).includes('one quiet room on Base'), await page.title());
const nav = await page.$$eval('header nav button', (bs) => bs.map((b) => b.innerText.replace(/\s+/g, ' ').trim()));
check('nav is Breathe/Cinema/Rewards/How it works', nav.length === 4 && nav[0].includes('Breathe') && nav[1].includes('Cinema') && nav[2].includes('Rewards') && nav[3].includes('How it works'), nav.join(' | '));
const cards = await page.$$eval('main button h2', (hs) => hs.map((h) => h.innerText.trim()));
check('home offers Breathe + Cinema cards', cards.includes('Breathe') && cards.includes('Cinema'), cards.join(' | '));
check('home shows the 0.10 USDC price', (await page.innerText('main')).includes('0.10 USDC'));

// ---- Cinema ----
await page.click('header nav button:has-text("Cinema")');
await page.waitForSelector('main .grid h3', { timeout: 20_000 });
const titles = await page.$$eval('main .grid h3', (hs) => hs.map((h) => h.innerText.trim()));
check('Cinema lists 4 animations', titles.length === 4, titles.join(' | '));
const unlocks = await page.$$eval('main .grid button', (bs) => bs.map((b) => b.innerText.trim()).filter((t) => t.includes('USDC')));
check('each card offers a 0.10 USDC unlock', unlocks.length === 4 && unlocks.every((b) => b.includes('0.10 USDC')), unlocks.join(' | '));
const posterCount = await page.$$eval('main .grid video', (vs) => vs.filter((v) => v.getAttribute('poster')).length);
check('previews show a poster', posterCount === 4, `${posterCount} posters`);
const autoplay = await page.$$eval('main .grid video', (vs) => vs.filter((v) => v.autoplay || !v.paused).length);
check('no preview autoplays (no 20MB download on load)', autoplay === 0, `${autoplay} playing`);
check('signed-out state asks for a sign-in', (await page.innerText('main')).includes('Connect a Base wallet'));

// free preview actually plays on demand
await page.click('main .grid video + div button');
await page.waitForTimeout(300);
await page.waitForTimeout(1500);
const played = await page.$$eval('main .grid video', (vs) => vs.filter((v) => !v.paused).length);
check('tap plays the free 5s preview', played === 1, `${played} playing`);
const previewLoaded = await page.$$eval('main .grid video', (vs) => vs.some((v) => v.currentTime > 0));
check('preview streams real frames', previewLoaded === true);

// ---- paywall refuses a signed-out wallet, without pretending to unlock ----
await page.click('main .grid button:has-text("Unlock")');
await page.waitForTimeout(2500);
const body = await page.innerText('main');
check('unlock without a wallet does NOT unlock anything', !body.includes('Watch full'));
const err = await page.$eval('main .text-danger', (el) => el.innerText.trim()).catch(() => '');
check('user gets an explicit error instead', /wallet|connect|sign/i.test(err), err.slice(0, 140));

// ---- How it works (no gameplay copy left) ----
await page.click('header nav button:has-text("How it works")');
await page.waitForTimeout(800);
const guide = await page.innerText('main');
check('guide explains the paid flow', guide.includes('Cinema') && guide.includes('0.10 USDC'));
check('guide advertises no grind (no XP/claimable/reward)', !/\+10 XP|1000 XP|claimable|Reward page|achievement unlocked/i.test(guide), guide.match(/[^.]*(XP|claimable|reward)[^.]*\./i)?.[0]?.slice(0,110) || 'clean');

// ---- Rewards page ----
await page.click('header nav button:has-text("Rewards")');
await page.waitForSelector('main h1', { timeout: 20_000 });
await page.waitForTimeout(1800);
const rwH1 = await page.innerText('main h1');
const rw = await page.innerText('main');
check('rewards page renders', /Rewards/i.test(rwH1), rwH1);
check('rewards explains the 25% share', /25%/.test(rw));
check("rewards shows today's pool", /TODAY'S POOL/i.test(rw));
check('rewards states the payout threshold', /0\.05 USDC/.test(rw));
check('rewards asks a signed-out wallet to sign in', /sign in to see what you have earned back/i.test(rw));
check('rewards stays non-gamified', /no points, no streaks/i.test(rw) && !/leaderboard|jackpot|spin to win|claim your prize/i.test(rw));
check('rewards shows the public pool numbers', /ALL-TIME POOL/i.test(rw));

console.log('\nconsole errors:', errors.length ? errors : '(none)');
console.log('failed requests:', failed.length ? failed : '(none)');
check('no console errors', errors.length === 0);
// Known third-party probes bundled with wallet connectivity:
//  - HEAD / from the wallet SDK's site check (aborted by the SDK itself)
//  - POST cca-lite.coinbase.com/metrics (Coinbase Wallet SDK telemetry)
const unknown = failed.filter((f) => !/cca-lite\.coinbase\.com|HEAD fetch https:\/\/ataraxia\.xhagents\.xyz\/ :: net::ERR_ABORTED/.test(f));
check('no unexpected failed requests', unknown.length === 0, unknown.join(' | '));
console.log('  (known wallet-SDK probes ignored:', failed.length - unknown.length, 'of', failed.length, ')');

await browser.close();
console.log(failures === 0 ? '\nALL BROWSER CHECKS PASSED' : `\n${failures} BROWSER CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
