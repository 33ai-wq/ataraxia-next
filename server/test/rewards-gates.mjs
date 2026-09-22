// Exercises the rewards payout gates with synthetic ledger rows, then removes them.
// No money can move: the rewards wallet holds 0 USDC and every refusal path is checked.
// Run: node test/rewards-gates.mjs
import { execFile } from 'node:child_process';
import http from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER = join(HERE, '..');
const DB = process.env.ATARAXIA_DB_FILE || join(SERVER, 'ataraxia.db');

const SMALL = '0x1111111111111111111111111111111111111111'; // 0.025 accrued (below 0.05 threshold)
const BIG = '0x2222222222222222222222222222222222222222';   // 0.10 accrued (eligible)
const WHALE = '0x3333333333333333333333333333333333333333'; // 3.00 accrued (over the 1 USD rule)
const TX_SMALL = '0x' + 'dead'.repeat(16);
const TX_BIG = '0x' + 'beef'.repeat(16);
const TX_WHALE = '0x' + 'cafe'.repeat(16);

// A local stub RPC keeps this test deterministic (public Base endpoints rate-limit bursts).
// It reports an EMPTY rewards wallet, so every approved batch must still refuse.
const stub = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    const { id, method } = JSON.parse(body || '{}');
    const result = method === 'eth_call' ? `0x${'0'.repeat(64)}`
      : method === 'eth_getBalance' ? '0x0'
        : method === 'eth_blockNumber' ? '0x1'
          : method === 'eth_chainId' ? '0x2105'
            : null;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ jsonrpc: '2.0', id, result }));
  });
});
await new Promise((r) => stub.listen(0, '127.0.0.1', r));
const STUB_RPC = `http://127.0.0.1:${stub.address().port}`;

let failures = 0;
const check = (name, cond, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!cond) failures += 1;
};

const db = new DatabaseSync(DB);
const insert = db.prepare(
  'INSERT OR REPLACE INTO rewards_ledger (tx_hash,address,day,amount_paid_atomic,accrued_atomic,created_at) VALUES (?,?,?,?,?,?)',
);
insert.run(TX_SMALL, SMALL, '2026-01-01', '100000', '25000', Date.now());   // 25% of 0.1
insert.run(TX_BIG, BIG, '2026-01-01', '400000', '100000', Date.now());      // 25% of 0.4
insert.run(TX_WHALE, WHALE, '2026-01-01', '12000000', '3000000', Date.now()); // 25% of 12

// Async on purpose: execFileSync would block this process's event loop and the
// stub RPC above would never be able to answer the child.
const run = (args, extraEnv = {}) => new Promise((resolve) => {
  execFile('node', [join(SERVER, 'scripts', 'pay_rewards.mjs'), ...args], {
    cwd: SERVER,
    env: { ...process.env, ATARAXIA_RPC: STUB_RPC, ...extraEnv },
    encoding: 'utf8',
    timeout: 120_000,
  }, (err, stdout, stderr) => {
    resolve({ code: err ? (err.code ?? 1) : 0, out: `${stdout || ''}${stderr || ''}` });
  });
});

try {
  // 1. dry run: shows the plan, signs nothing
  const dry = await run([]);
  check('dry run exits 0', dry.code === 0, `code=${dry.code}`);
  check('dry run lists the eligible wallet', dry.out.includes(BIG), 'BIG wallet in plan');
  check('dry run holds back the below-threshold wallet', dry.out.includes('held back'), 'skipped');
  check('dry run signs nothing', /DRY RUN — no transaction signed/.test(dry.out));

  // 2. --execute without a Sentinel ticket must refuse
  const noTicket = await run(['--execute']);
  check('execute without a Sentinel ticket is REFUSED', noTicket.code === 2 && /no Sentinel ticket/.test(noTicket.out), `code=${noTicket.code}`);

  // 3. with a ticket but over the 1 USD rule and no BOSS_APPROVED must refuse
  const noBoss = await run(['--execute', '--cap', '10'], { SENTINEL_TICKET: 'SG-TEST-1' });
  check('over-1-USD batch without BOSS_APPROVED is REFUSED', noBoss.code === 2 && /explicit confirmation/.test(noBoss.out), `code=${noBoss.code}`);

  // 4. the cap holds the whale back instead of overspending, and the batch then
  //    stops at the empty rewards wallet (never at a signature)
  const capped = await run(['--execute', '--cap', '0.5'], { SENTINEL_TICKET: 'SG-TEST-1', BOSS_APPROVED: '1' });
  check('cap holds the whale back', capped.out.includes('held back'), 'skipped line');
  check('capped batch never exceeds the cap', /total 0\.1000 USDC/.test(capped.out), capped.out.split('\n').find((l) => l.includes('transfer(s)')) || '');
  check('capped approved batch stops at the empty rewards wallet', capped.code === 2 && /holds .* atomic USDC but the batch needs/.test(capped.out), `code=${capped.code}; ${capped.out.trim().split('\n').pop()}`);

  // 5. fully approved batch still refuses because the rewards wallet is empty
  const empty = await run(['--execute', '--cap', '10'], { SENTINEL_TICKET: 'SG-TEST-1', BOSS_APPROVED: '1' });
  check('approved batch stops at the empty rewards wallet', empty.code === 2 && /holds .* atomic USDC but the batch needs/.test(empty.out), `code=${empty.code}; ${empty.out.trim().split('\n').pop()}`);

  // 6. a broken RPC refuses instead of crashing (fail closed, nothing signed)
  const deadRpc = await run(['--execute', '--cap', '10'], { SENTINEL_TICKET: 'SG-TEST-1', BOSS_APPROVED: '1', ATARAXIA_RPC: 'http://127.0.0.1:1' });
  check('unreachable RPC refuses cleanly', deadRpc.code === 2 && /could not read the rewards wallet from the RPC/.test(deadRpc.out), `code=${deadRpc.code}`);

  // 7. no transaction was ever recorded
  const sent = db.prepare("SELECT COUNT(*) AS n FROM rewards_payouts WHERE tx_hash IS NOT NULL").get().n;
  check('no payout transaction was recorded', sent === 0, `${sent} rows`);

  // 8. the public endpoint reports the honest pool
  const pub = await (await fetch('http://127.0.0.1:3110/api/rewards/public')).json();
  check('public pool equals the synthetic accruals', pub.allTime.poolAtomic === '3125000', `poolAtomic=${pub.allTime.poolAtomic}`);
  check('public endpoint exposes the 25% share', pub.share === 0.25);
} finally {
  db.prepare('DELETE FROM rewards_ledger WHERE tx_hash IN (?,?,?)').run(TX_SMALL, TX_BIG, TX_WHALE);
  db.prepare("DELETE FROM rewards_payouts WHERE ticket = 'SG-TEST-1'").run();
  stub.closeAllConnections?.();
  stub.close();
  const left = db.prepare('SELECT COUNT(*) AS n FROM rewards_ledger').get().n;
  console.log(`cleaned up synthetic rows — ledger now holds ${left} real row(s)`);
  db.close();
}

console.log(failures === 0 ? '\nALL REWARDS GATE CHECKS PASSED' : `\n${failures} REWARDS GATE CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
