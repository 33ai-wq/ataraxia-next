import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { watchAccount } from '@wagmi/core';
import { wagmiConfig } from '../components/WalletModal';
import {
  getConfig, getCatalog, getSession, getAccess, getNonce,
  verifySignature, openInvoice, verifyPayment, mediaUrl,
} from '../lib/ataraxiaApi';
import { adoptInjectedAccount, ensureBaseChain, siweMessage, signSiwe, payUsdc, basescanTx } from '../lib/base';

const fmtUsdc = (atomic) => (Number(atomic) / 1e6).toFixed(2);
const short = (a) => (a ? `${a.slice(0, 6)}...${a.slice(-4)}` : '');

// Per-video unlock state machine: idle -> signing -> invoicing -> paying -> verifying -> done
const PHASE_LABEL = {
  signing: 'Signing in...',
  invoicing: 'Opening invoice...',
  paying: 'Confirm in wallet...',
  verifying: 'Verifying on Base...',
};

function Cinema({ wallet, onBack, showToast }) {
  const [cfg, setCfg] = useState(null);
  const [items, setItems] = useState([]);
  const [session, setSession] = useState({ authed: false, address: null });
  const [unlocked, setUnlocked] = useState(() => new Set());
  const [account, setAccount] = useState(null);
  const [busy, setBusy] = useState({ videoId: null, phase: null });
  const [error, setError] = useState({ videoId: null, message: '' });
  const [player, setPlayer] = useState(null);
  const [lastTx, setLastTx] = useState(null);
  const previewRefs = useRef({});

  // Free previews never autoload: a poster costs ~50 kB, a 5 s clip costs ~5.7 MB.
  // One preview plays at a time, on an explicit tap.
  const togglePreview = useCallback((id) => {
    Object.entries(previewRefs.current).forEach(([key, el]) => {
      if (!el) return;
      if (key === id) {
        if (el.paused) { el.play?.().catch(() => {}); } else { el.pause?.(); }
      } else if (!el.paused) {
        el.pause?.();
      }
    });
  }, []);

  const refreshAccess = useCallback(async () => {
    const [s, a] = await Promise.all([getSession(), getAccess()]);
    setSession({ authed: Boolean(s.authed), address: s.address || null });
    setUnlocked(new Set(Array.isArray(a.unlocked) ? a.unlocked : []));
    return { s, a };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [c, cat] = await Promise.all([getConfig(), getCatalog()]);
        if (!alive) return;
        setCfg(c);
        setItems(Array.isArray(cat.items) ? cat.items : []);
        await refreshAccess();
      } catch {
        if (alive) showToast('Could not reach the Ataraxia service', 'error');
      }
    })();
    const unwatch = watchAccount(wagmiConfig, {
      onChange(acc) {
        if (!alive) return;
        setAccount(acc?.address ? { address: acc.address, chainId: Number(acc.chainId) } : null);
      },
    });
    return () => { alive = false; unwatch?.(); };
  }, [refreshAccess, showToast]);

  const effectiveAddress = account?.address || wallet?.address || null;
  const sessionMatches = Boolean(session.authed && effectiveAddress && session.address?.toLowerCase() === effectiveAddress.toLowerCase());

  const signIn = useCallback(async () => {
    try {
      setError({ videoId: null, message: '' });
      setBusy({ videoId: null, phase: 'signing' });
      const acc = await adoptInjectedAccount();
      await ensureBaseChain();
      const { nonce } = await getNonce(acc.address);
      if (!nonce) throw new Error('No sign-in nonce — try again');
      const message = siweMessage(acc.address, nonce);
      const signature = await signSiwe(message);
      const res = await verifySignature({ address: acc.address, message, signature });
      if (!res.ok) throw new Error(res.message || res.error || 'Signature rejected');
      await refreshAccess();
      showToast('Signed in — unlock history restored', 'success');
    } catch (e) {
      const msg = e?.shortMessage || e?.message || 'Sign-in failed';
      setError({ videoId: null, message: msg });
      showToast(msg, 'error');
    } finally {
      setBusy({ videoId: null, phase: null });
    }
  }, [refreshAccess, showToast]);

  const unlock = useCallback(async (item) => {
    if (!cfg) return;
    try {
      setError({ videoId: null, message: '' });
      if (!sessionMatches) {
        await signIn();
        const s = await getSession();
        if (!s.authed) throw new Error('Sign-in required before paying');
      }
      setBusy({ videoId: item.id, phase: 'invoicing' });
      const inv = await openInvoice(item.id);
      if (inv.alreadyUnlocked) {
        setUnlocked((prev) => new Set(prev).add(item.id));
        setBusy({ videoId: null, phase: null });
        setPlayer(item);
        return;
      }
      if (!inv.invoiceId) throw new Error(inv.error || 'Could not open invoice');

      setBusy({ videoId: item.id, phase: 'paying' });
      const { hash } = await payUsdc({ to: inv.payTo, amountAtomic: inv.amountAtomic });

      setBusy({ videoId: item.id, phase: 'verifying' });
      let result = null;
      for (let attempt = 0; attempt < 6; attempt += 1) {
        result = await verifyPayment(inv.invoiceId, hash);
        if (result.ok) break;
        if (result.status !== 202) break; // 202 = not yet confirmed, retry
        await new Promise((r) => setTimeout(r, 2500));
      }
      if (!result?.ok) throw new Error(result?.reason || 'Payment could not be verified');

      setLastTx({ hash: result.txHash || hash, videoId: item.id });
      await refreshAccess();
      showToast(`Unlocked ${item.title} — ${fmtUsdc(inv.amountAtomic)} USDC`, 'success');
      setPlayer(item);
    } catch (e) {
      const raw = e?.shortMessage || e?.message || 'Payment failed';
      const msg = /User rejected|denied/i.test(raw) ? 'Payment cancelled in wallet' : raw;
      setError({ videoId: item.id, message: msg });
      showToast(msg, 'error');
    } finally {
      setBusy({ videoId: null, phase: null });
    }
  }, [cfg, refreshAccess, sessionMatches, showToast, signIn]);

  const openPlayer = useCallback((item) => {
    if (!unlocked.has(item.id)) {
      showToast('Unlock this animation to watch the full 109s version', 'info');
      return;
    }
    setPlayer(item);
  }, [showToast, unlocked]);

  const price = useMemo(() => (cfg?.priceAtomic ? fmtUsdc(cfg.priceAtomic) : '0.10'), [cfg]);

  return (
    <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="w-10 h-10 rounded-xl bg-card border border-border text-fg-muted hover:border-accent hover:text-accent transition-colors">←</button>
        <div className="flex-1">
          <h1 className="font-heading text-3xl md:text-4xl font-bold tracking-tight">Cinema</h1>
          <p className="text-fg-muted text-sm">XH Animations — each one extended 21× to 109 seconds. {price} USDC on Base, once, kept for that wallet.</p>
        </div>
      </div>

      <div className="mb-6 p-4 bg-card border border-border rounded-2xl flex flex-wrap items-center gap-3 justify-between">
        <div className="text-sm text-fg-muted">
          {sessionMatches ? (
            <span>Signed in as <span className="font-mono text-fg">{short(session.address)}</span> · {unlocked.size}/{items.length} unlocked</span>
          ) : effectiveAddress ? (
            <span>Wallet <span className="font-mono text-fg">{short(effectiveAddress)}</span> connected — sign in once to load your unlocks.</span>
          ) : (
            <span>Connect a Base wallet to unlock animations.</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!sessionMatches && (
            <button
              onClick={signIn}
              disabled={Boolean(busy.phase)}
              className="btn-primary px-5 py-2 text-sm disabled:opacity-60"
            >
              {busy.phase === 'signing' ? 'Signing in...' : 'Sign in (free, no gas)'}
            </button>
          )}
          {cfg?.payTo && (
            <span className="text-[11px] font-mono text-fg-muted/70 hidden md:inline">payTo {short(cfg.payTo)}</span>
          )}
        </div>
      </div>

      {error.message && (
        <div className="mb-6 p-4 rounded-2xl border border-danger/40 bg-card text-sm text-danger">{error.message}</div>
      )}

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => {
          const isUnlocked = unlocked.has(item.id);
          const isBusy = busy.videoId === item.id;
          return (
            <div key={item.id} className="bg-card border border-border rounded-2xl overflow-hidden hover:border-accent/30 transition-colors flex flex-col">
              <div className="relative aspect-video bg-black">
                {isUnlocked ? (
                  <video
                    src={mediaUrl(item.id)}
                    poster={item.poster}
                    className="w-full h-full object-cover"
                    controls
                    preload="metadata"
                    playsInline
                  />
                ) : (
                  <>
                    <video
                      ref={(el) => { previewRefs.current[item.id] = el; }}
                      src={item.preview}
                      poster={item.poster}
                      className="w-full h-full object-cover"
                      muted
                      loop
                      playsInline
                      preload="none"
                    />
                    <div className="absolute inset-0 bg-black/45 hover:bg-black/30 transition-colors flex flex-col items-center justify-center gap-2">
                      <button
                        onClick={() => togglePreview(item.id)}
                        className="w-12 h-12 rounded-full bg-black/60 border border-white/25 text-lg text-white hover:bg-black/80 transition-colors"
                        aria-label={`Play the free 5s preview of ${item.title}`}
                      >
                        ▶
                      </button>
                      <span className="text-[10px] uppercase tracking-widest text-white/70">free {Math.round(item.previewSec)}s preview</span>
                    </div>
                  </>
                )}
                <span className="absolute top-2 left-2 text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-black/70 text-fg-muted">
                  {isUnlocked ? 'unlocked' : `${Math.round(item.durationSec)}s full`}
                </span>
              </div>
              <div className="p-4 flex-1 flex flex-col">
                <h3 className="font-heading text-base font-semibold leading-tight break-words">{item.title}</h3>
                <p className="text-fg-muted text-xs mt-1">{item.subtitle} · {Math.round(item.durationSec)}s</p>
                <div className="mt-auto pt-4">
                  {isUnlocked ? (
                    <button onClick={() => openPlayer(item)} className="w-full px-4 py-2.5 rounded-xl border border-accent/40 text-accent text-sm hover:bg-accent/10 transition-colors">
                      ▶ Watch full
                    </button>
                  ) : (
                    <button
                      onClick={() => unlock(item)}
                      disabled={isBusy || Boolean(busy.phase)}
                      className="w-full btn-primary py-2.5 text-sm disabled:opacity-60"
                    >
                      {isBusy ? PHASE_LABEL[busy.phase] || 'Working...' : `Unlock · ${fmtUsdc(item.priceAtomic)} USDC`}
                    </button>
                  )}
                  {lastTx?.videoId === item.id && (
                    <a href={basescanTx(lastTx.hash)} target="_blank" rel="noopener noreferrer" className="block text-center text-[11px] text-fg-muted/70 hover:text-accent mt-2">
                      view transaction ↗
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {items.length === 0 && (
          <div className="col-span-full p-8 text-center text-fg-muted text-sm bg-card border border-border rounded-2xl">
            Loading the reel...
          </div>
        )}
      </div>

      <p className="mt-6 text-xs text-fg-muted/60">
        Every unlock is one plain USDC transfer on Base from your own wallet to the Ataraxia treasury — no subscription, no custody,
        no hidden checkout. The 109s masters are streamed only to wallets that paid.
      </p>

      {player && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" onClick={() => setPlayer(null)}>
          <div className="bg-card rounded-2xl max-w-4xl w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div>
                <h2 className="font-heading text-lg font-semibold">{player.title}</h2>
                <p className="text-fg-muted text-xs">{player.subtitle} · {Math.round(player.durationSec)}s</p>
              </div>
              <button onClick={() => setPlayer(null)} className="w-9 h-9 rounded-full bg-bg border border-border text-fg-muted">✕</button>
            </div>
            <video
              key={player.id}
              src={mediaUrl(player.id)}
              poster={player.poster}
              className="w-full aspect-video bg-black"
              controls
              autoPlay
              playsInline
            />
          </div>
        </div>
      )}
    </main>
  );
}

export default Cinema;
