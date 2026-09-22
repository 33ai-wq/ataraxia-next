import { useCallback, useEffect, useState } from 'react';
import { getRewards, getRewardsPublic } from '../lib/ataraxiaApi';

const usdc = (atomic, dp = 4) => (Number(atomic || 0) / 1e6).toFixed(dp);
const short = (a) => (a ? `${a.slice(0, 6)}...${a.slice(-4)}` : '');

function Stat({ label, value, hint }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <p className="text-[11px] uppercase tracking-widest text-fg-muted/70 mb-1">{label}</p>
      <p className="font-heading text-2xl md:text-3xl font-bold tracking-tight">{value}</p>
      {hint && <p className="text-xs text-fg-muted mt-1">{hint}</p>}
    </div>
  );
}

function Rewards({ onBack, showToast }) {
  const [mine, setMine] = useState(null);
  const [pub, setPub] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, p] = await Promise.all([getRewards(), getRewardsPublic()]);
      setMine(m);
      setPub(p);
    } catch {
      showToast?.('Could not read the rewards ledger just now', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const share = Math.round(((mine?.share ?? pub?.share ?? 0.25) * 100));
  const me = mine?.me;
  const threshold = Number(mine?.minPayoutAtomic || pub?.minPayoutAtomic || 50000) / 1e6;

  return (
    <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="w-10 h-10 rounded-xl bg-card border border-border text-fg-muted hover:border-accent hover:text-accent transition-colors">←</button>
        <div className="flex-1">
          <h1 className="font-heading text-3xl md:text-4xl font-bold tracking-tight">Rewards</h1>
          <p className="text-fg-muted text-sm">
            {share}% of everything paid in this room comes back to the wallets that paid it. No points, no streaks, nothing to farm — just a share returned.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <Stat
          label="Today's pool"
          value={`${usdc(pub?.today?.poolAtomic)} USDC`}
          hint={`${share}% of ${pub?.today?.payers || 0} payment(s) today`}
        />
        <Stat
          label="All-time pool"
          value={`${usdc(pub?.allTime?.poolAtomic)} USDC`}
          hint={`${pub?.allTime?.payers || 0} wallet(s) · ${usdc(pub?.allTime?.paidOutAtomic)} already paid out`}
        />
        <Stat
          label={me ? 'Your quiet rebate' : 'Your rebate'}
          value={me ? `${usdc(me.remainingAtomic)} USDC` : '—'}
          hint={me
            ? (me.eligible ? 'ready for the next payout batch' : `paid out automatically once you reach ${threshold.toFixed(2)} USDC`)
            : 'sign in to see what you have earned back'}
        />
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 mb-6">
        <h2 className="font-heading text-lg font-semibold mb-3">How it works</h2>
        <ol className="text-fg-muted text-sm leading-relaxed space-y-2 list-decimal pl-5">
          <li>You unlock a film — one plain {usdc(100000, 2)} USDC transfer on Base to the Ataraxia treasury.</li>
          <li>{share}% of that amount is credited to your wallet in the rewards ledger, the moment the payment is verified on-chain.</li>
          <li>Payout batches are paid out of a dedicated rewards wallet, separate from the treasury. When your balance reaches {threshold.toFixed(2)} USDC it is sent to you automatically — you sign nothing and pay no gas.</li>
          <li>If you prefer to wait, it simply keeps accumulating against your wallet. Every tx is verifiable on Basescan.</li>
        </ol>
        <p className="text-xs text-fg-muted/60 mt-4">
          No token, no staking, no lottery tickets to buy. Rewards are funded only from what people actually paid, so the pool can never promise more than it took in.
          {pub?.rewardsAddress ? <> Rewards wallet: <span className="font-mono">{short(pub.rewardsAddress)}</span>.</> : null}
        </p>
      </div>

      {mine?.authed && me ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3 mb-6">
            <Stat label="You paid in" value={`${usdc(me.paidAtomic)} USDC`} hint={`${me.payments} payment(s)`} />
            <Stat label="Accrued to you" value={`${usdc(me.accruedAtomic)} USDC`} hint={`${share}% of what you paid`} />
            <Stat label="Already sent" value={`${usdc(me.sentAtomic)} USDC`} hint={me.sentAtomic === '0' ? 'no payout yet' : 'paid to your wallet'} />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <section className="bg-card border border-border rounded-2xl p-5">
              <h3 className="font-heading text-base font-semibold mb-3">Your payments</h3>
              {mine.ledger?.length ? (
                <ul className="space-y-2 text-sm">
                  {mine.ledger.map((l) => (
                    <li key={l.txHash} className="flex items-center justify-between gap-3 text-fg-muted">
                      <span>{l.day}</span>
                      <span className="font-mono">{usdc(l.paidAtomic, 2)} → {usdc(l.accruedAtomic)} USDC back</span>
                      <a href={l.explorer} target="_blank" rel="noopener noreferrer" className="text-accent/80 hover:text-accent">tx ↗</a>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-fg-muted text-sm">No payments from this wallet yet.</p>}
            </section>

            <section className="bg-card border border-border rounded-2xl p-5">
              <h3 className="font-heading text-base font-semibold mb-3">Payouts to you</h3>
              {mine.payouts?.length ? (
                <ul className="space-y-2 text-sm">
                  {mine.payouts.map((p) => (
                    <li key={p.createdAt} className="flex items-center justify-between gap-3 text-fg-muted">
                      <span>{new Date(p.createdAt).toISOString().slice(0, 10)}</span>
                      <span className="font-mono">{usdc(p.amountAtomic)} USDC</span>
                      {p.explorer
                        ? <a href={p.explorer} target="_blank" rel="noopener noreferrer" className="text-accent/80 hover:text-accent">tx ↗</a>
                        : <span className="text-xs">{p.status}</span>}
                    </li>
                  ))}
                </ul>
              ) : <p className="text-fg-muted text-sm">Nothing paid out yet — your balance is still accumulating.</p>}
            </section>
          </div>

          <button onClick={load} className="mt-6 text-sm px-6 py-3 rounded-full border border-border text-fg-muted hover:border-accent hover:text-accent transition-all">
            {loading ? 'Reading ledger...' : 'Refresh'}
          </button>
        </>
      ) : (
        <div className="bg-card border border-border rounded-2xl p-6 text-sm text-fg-muted">
          {mine?.authed === false
            ? 'Sign in with your wallet (Cinema → Sign in, free) to see your rebate balance and history. The public pool above is the same ledger, just without addresses.'
            : 'Loading the ledger...'}
        </div>
      )}

      <p className="mt-6 text-xs text-fg-muted/60">
        Rewards accounting is public and auditable: every credit is derived from a payment transaction, and every payout batch is a normal USDC transfer you can verify.
      </p>
    </main>
  );
}

export default Rewards;
