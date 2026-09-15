import { useEffect, useState } from 'react';

const REWARD_KEY = 'ataraxia-reward-claims';

function loadClaims(){ try{ const r=localStorage.getItem(REWARD_KEY); return r? JSON.parse(r): []; }catch{ return []; } }

export default function Reward({ xp, wallet, showToast }) {
  const [claims, setClaims] = useState(loadClaims);
  const usdc = Math.floor(xp / 1000) * 0.1; // $0.1 per 1000 XP, floor
  const nextIn = 1000 - (xp % 1000);
  const claimableUnits = Math.floor(xp/1000) - claims.reduce((s,c)=> s + c.units, 0);
  const claimableUsdc = claimableUnits * 0.1;

  const doClaim = () => {
    if (!wallet) { showToast?.('Connect wallet to claim','error'); return; }
    if (claimableUnits <= 0) { showToast?.('No claimable reward yet — keep breathing','info'); return; }
    // mock claim: store locally, in prod this would call backend / treasury
    const entry = { at: new Date().toISOString(), units: claimableUnits, usdc: claimableUsdc, address: wallet.address, chain: wallet.chain, tx: null };
    const next = [entry, ...claims].slice(0,20);
    try{ localStorage.setItem(REWARD_KEY, JSON.stringify(next)); }catch{}
    setClaims(next);
    showToast?.(`Claim queued: ${claimableUsdc.toFixed(2)} USDC for ${claimableUnits*1000} XP — will be reviewed`,'success');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center py-2">
        <p className="text-3xl mb-2">🎁</p>
        <h2 className="font-heading text-3xl font-bold">Rewards</h2>
        <p className="text-fg-muted text-sm">1000 XP = $0.10 USDC · Free during beta · No gas on claim queue</p>
      </div>

      <section className="bg-card border border-border rounded-2xl p-6">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-bg border border-border rounded-xl p-4">
            <div className="text-2xl font-bold font-mono">{xp.toLocaleString()}</div>
            <div className="text-[11px] tracking-widest uppercase text-fg-muted">Total XP</div>
          </div>
          <div className="bg-bg border border-border rounded-xl p-4">
            <div className="text-2xl font-bold font-mono">${usdc.toFixed(2)}</div>
            <div className="text-[11px] tracking-widest uppercase text-fg-muted">Earned value</div>
          </div>
          <div className="bg-accent-dim border border-accent/40 rounded-xl p-4">
            <div className="text-2xl font-bold font-mono">${claimableUsdc.toFixed(2)}</div>
            <div className="text-[11px] tracking-widest uppercase text-accent">Claimable</div>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-fg-muted">{claimableUnits>0 ? `${claimableUnits*1000} XP ready to claim` : `${nextIn} XP to next $0.10` } · Rate 1000 XP → $0.10</p>
          <button onClick={doClaim} disabled={claimableUnits<=0 || !wallet} className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all ${claimableUnits>0 && wallet ? 'bg-accent text-bg hover:shadow-[0_0_20px_var(--color-accent-glow)]' : 'bg-bg border border-border text-fg-muted opacity-60 cursor-not-allowed'}`}>
            {wallet ? `Claim $${claimableUsdc.toFixed(2)} USDC` : 'Connect wallet to claim'}
          </button>
        </div>
        {!wallet && <p className="text-[11px] text-fg-muted mt-2">Connect Base or Solana wallet on Dashboard first.</p>}
      </section>

      <section className="bg-card border border-border rounded-2xl p-6">
        <h3 className="font-heading font-semibold mb-3">How it works</h3>
        <ol className="text-sm text-fg-muted space-y-2 list-decimal list-inside">
          <li>Breathe, draw sand, mix sounds — each action earns XP (10 XP / breath cycle, 2 XP / 50 grains, etc).</li>
          <li>Every 1000 XP = $0.10 USDC claimable. Your XP never expires during beta.</li>
          <li>Claim creates a local queue entry with your wallet address. No on-chain tx yet.</li>
          <li>During beta, claims are reviewed manually and USDC is sent from treasury (Base 0x57EE…F357 / Solana GhFb…) — you’ll get a Basescan/Solscan link in history.</li>
        </ol>
        <div className="mt-4 p-3 bg-bg border border-border rounded-xl">
          <p className="text-xs font-semibold mb-1">Boss’s best implementation (recommendation)</p>
          <p className="text-xs text-fg-muted leading-relaxed">
            Keep it <b className="text-fg">off-chain queue + manual drip</b> while free. Avoid direct auto-payout (sybil farming). Add later: Sentinel anti-sybil (wallet must hold ≥ $1 or have 7-day streak), cap $1/day/wallet, weekly Merkle root on Base for trustless claims. For now X402 is not needed — just “Free: connect wallet → play → queue claim”.
          </p>
        </div>
      </section>

      <section className="bg-card border border-border rounded-2xl p-6">
        <h3 className="font-heading font-semibold mb-3">Claim history (local)</h3>
        {claims.length===0 ? <p className="text-sm text-fg-muted">No claims yet. Earn 1000 XP to see your first claim here.</p> : (
          <div className="space-y-2">
            {claims.map((c,i)=>(
              <div key={i} className="flex items-center gap-3 p-3 bg-bg border border-border rounded-xl text-sm">
                <span className="text-accent font-mono text-xs">${c.usdc.toFixed(2)}</span>
                <span className="text-fg-muted text-xs">{c.units*1000} XP · {new Date(c.at).toLocaleString()}</span>
                <span className="ml-auto text-[11px] font-mono text-fg-muted">{c.address.slice(0,6)}...{c.address.slice(-4)} · {c.chain}</span>
                <span className="text-[11px] px-2 py-1 rounded-full bg-warning/20 text-warning border border-warning/30">Queued</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
