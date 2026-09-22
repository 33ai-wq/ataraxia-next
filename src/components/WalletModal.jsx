import { useEffect, useRef, useState } from 'react';
import { createAppKit } from '@reown/appkit/react';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { SolanaAdapter } from '@reown/appkit-adapter-solana';
import { base, mainnet, solana } from '@reown/appkit/networks';
import { Attribution } from 'ox/erc8021';
import QRCode from 'qrcode';

// Reown project ID for WalletConnect
const REOWN_PROJECT_ID = (import.meta.env?.VITE_REOWN_PROJECT_ID || '886f8719c01b034b65dad40b625434a8').trim();

// Base Builder Code (Base.dev) — ERC-8021 attribution. Set at build time with
// VITE_BUILDER_CODE; when empty the app simply sends unattributed transactions.
const BUILDER_CODE = (import.meta.env?.VITE_BUILDER_CODE || '').trim();
let DATA_SUFFIX = null;
if (BUILDER_CODE) {
  try {
    DATA_SUFFIX = Attribution.toDataSuffix({ codes: [BUILDER_CODE] });
  } catch (e) {
    console.error('[Ataraxia] bad builder code, attribution disabled:', e);
  }
}
export const BUILDER_CODE_ACTIVE = Boolean(DATA_SUFFIX);

// Local wallet logos (served from public/wallets/)
const WALLET_ICONS = {
  metamask: '/wallets/metamask.png',
  coinbase: '/wallets/coinbase.png',
  rainbow: '/wallets/rainbow.png',
  trust: '/wallets/trust.png',
  walletconnect: '/wallets/walletconnect.png',
  rabby: '/wallets/rabby.png',
  phantom: '/wallets/phantom.png',
  solflare: '/wallets/solflare.png',
  backpack: '/wallets/backpack.png',
  glow: '/wallets/glow.png',
};

const metadata = {
  name: 'Ataraxia',
  description: 'A wallet-gated sanctuary for calm. Breathe. Listen. Play with sand.',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://ataraxia.xhagents.xyz',
  icons: ['/logo.png'],
};

// Adapters — one per namespace. `dataSuffix` is forwarded by WagmiAdapter into
// wagmi's createConfig, so every transaction sent through wagmi carries the
// ERC-8021 attribution tag automatically.
const wagmiAdapter = new WagmiAdapter({
  networks: [base, mainnet],
  projectId: REOWN_PROJECT_ID,
  ssr: true,
  ...(DATA_SUFFIX ? { dataSuffix: DATA_SUFFIX } : {}),
});

// Exposed so feature code (Cinema payments, SIWE) can use @wagmi/core actions
// on exactly the same wagmi config that AppKit drives.
export const wagmiConfig = wagmiAdapter.wagmiConfig;

const solanaAdapter = new SolanaAdapter();

// Single AppKit instance holding both namespaces (documented keys only).
let appKitModal = null;

if (typeof window !== 'undefined' && !appKitModal) {
  try {
    appKitModal = createAppKit({
      adapters: [wagmiAdapter, solanaAdapter],
      networks: [base, mainnet, solana],
      defaultNetwork: base,
      projectId: REOWN_PROJECT_ID,
      metadata,
      themeMode: 'dark',
      themeVariables: {
        '--w3m-accent': '#00d4aa',
        '--w3m-color-mix': '#0a0a0f',
        '--w3m-color-mix-strength': 30,
        '--w3m-font-family': 'DM Sans, Space Grotesk, sans-serif',
        '--w3m-border-radius-master': '16px',
      },
      features: {
        analytics: false,
        email: false,
        socials: false,
        emailShowWallets: false,
      },
      connectorImages: WALLET_ICONS,
    });
  } catch (e) {
    console.error('[Ataraxia] AppKit init failed:', e);
  }
}

export async function disconnectAppKit() {
  try {
    await appKitModal?.disconnect();
  } catch (e) {
    console.error('[Ataraxia] disconnect failed:', e);
  }
}

// ---- WalletConnect: our own QR + wallet directory (reliable) ----
// We render the pairing ourselves instead of depending on the Reown modal UI:
// 1. pairing URI comes from AppKit's own UniversalProvider (same session wire,
//    so approval lands in subscribeAccount and enters the sanctuary),
// 2. wallet directory + logos come from the WalletGuide explorer API,
// 3. "Buka" buttons use each wallet's universal link with the wc URI attached.

const SOLANA_CHAIN = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';

const FALLBACK_WC = {
  base: [
    { name: 'MetaMask', logo: WALLET_ICONS.metamask, universal: 'https://metamask.app.link' },
    { name: 'Trust Wallet', logo: WALLET_ICONS.trust, universal: 'https://link.trustwallet.com' },
    { name: 'Rainbow', logo: WALLET_ICONS.rainbow, universal: 'https://rnbwapp.com' },
    { name: 'Coinbase Wallet', logo: WALLET_ICONS.coinbase, universal: 'https://go.cb-w.com' },
  ],
  solana: [
    { name: 'Phantom', logo: WALLET_ICONS.phantom, universal: 'https://phantom.app/ul' },
    { name: 'Solflare', logo: WALLET_ICONS.solflare, universal: 'https://solflare.com/ul' },
    { name: 'Backpack', logo: WALLET_ICONS.backpack, universal: 'https://backpack.app/ul' },
    { name: 'Glow', logo: WALLET_ICONS.glow, universal: 'https://glow.app/ul' },
  ],
};

async function fetchWcWallets(chain) {
  const chains = chain === 'base' ? 'eip155:8453' : SOLANA_CHAIN;
  const r = await fetch(
    `https://explorer-api.walletconnect.com/v3/wallets?projectId=${REOWN_PROJECT_ID}&version=2&chains=${encodeURIComponent(chains)}&entries=12&page=1`
  );
  if (!r.ok) throw new Error('explorer api error');
  const j = await r.json();
  const list = Object.values(j.listings || {}).map((w) => ({
    name: w.name,
    logo: w.image_url?.sm || w.image_url?.md || '',
    universal: w.mobile?.universal || '',
    native: w.mobile?.native || '',
    ios: w.app?.ios || '',
    android: w.app?.android || '',
  })).filter((w) => w.universal || w.native);
  if (!list.length) throw new Error('empty explorer list');
  return list;
}

function deepLink(w, uri) {
  const b = (w.universal || w.native || '').replace(/\/$/, '');
  if (!b || !uri) return null;
  if (/[?&]uri=/.test(b)) return b + encodeURIComponent(uri);
  return b + '/wc?uri=' + encodeURIComponent(uri);
}

// AppKit 1.8 exposes getUniversalProvider() as an ASYNC method returning the
// WalletConnect UniversalProvider. Forgetting the await yields a Promise, and
// `promise.on(...)` throws "on is not a function" — which is exactly how the QR
// pairing used to die. Await it, then subscribe to 'display_uri'.
async function startPairing(chain) {
  const provider = await appKitModal?.getUniversalProvider?.();
  if (!provider || typeof provider.on !== 'function') {
    throw new Error('WalletConnect belum siap — pakai wallet di browser (MetaMask/Coinbase) atau Base Account');
  }
  try { provider.disconnect?.().catch?.(() => {}); } catch {}
  const namespaces = chain === 'base'
    ? { eip155: { methods: ['eth_sendTransaction', 'personal_sign', 'eth_signTypedData', 'eth_signTypedData_v4', 'wallet_switchEthereumChain'], chains: ['eip155:8453', 'eip155:1'], events: ['chainChanged', 'accountsChanged'] } }
    : { solana: { methods: ['sol_signMessage', 'solana_signMessage', 'sol_signTransaction', 'solana_signTransaction', 'solana_signAndSendTransaction'], chains: [SOLANA_CHAIN], events: [] } };
  return new Promise((resolve, reject) => {
    const to = setTimeout(() => { cleanup(); reject(new Error('Timeout membuat tautan — coba lagi')); }, 30000);
    const onUri = (u) => { clearTimeout(to); cleanup(); resolve(u); };
    const cleanup = () => { try { provider.removeListener?.('display_uri', onUri); } catch {} };
    try { provider.on('display_uri', onUri); }
    catch (e) { clearTimeout(to); reject(e); return; }
    // Resolves when the user approves in their wallet; subscribeAccount picks it up.
    provider.connect({ optionalNamespaces: namespaces }).catch(() => {});
  });
}

// Base Account (Coinbase Smart Wallet, CDP) — passkey login, no QR, no seed.
// This is the wallet that works inside the Base App's in-app browser and is
// sponsored by Base when the CDP project allows it.
async function startBaseAccount() {
  const { connect, getAccount } = await import('@wagmi/core');
  const { baseAccount } = await import('wagmi/connectors');
  // The passkey ceremony happens in Coinbase's own frame; give it room, but do
  // not leave the button spinning forever if the user dismisses it.
  const withTimeout = (p, ms, msg) =>
    Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(msg)), ms))]);
  await withTimeout(
    connect(wagmiConfig, { connector: baseAccount({ appName: 'Ataraxia' }) }),
    90_000,
    'Base Account timed out — approve the passkey prompt (or use MetaMask / WalletConnect)',
  );
  const acc = getAccount(wagmiConfig);
  if (!acc.address) throw new Error('Base Account did not return an address');
  return acc.address;
}

// Direct (injected) wallet detection
const EVM_WALLETS = [
  {
    id: 'baseaccount',
    name: 'Base Account',
    subtitle: 'Passkey · CDP',
    icon: WALLET_ICONS.coinbase,
    color: '#0052FF',
    detect: () => true, // passkey smart wallet: works in any browser, no extension
  },
  {
    id: 'metamask',
    name: 'MetaMask',
    subtitle: 'Most popular',
    icon: WALLET_ICONS.metamask,
    color: '#E8831D',
    detect: () => typeof window !== 'undefined' && !!window.ethereum?.isMetaMask,
  },
  {
    id: 'coinbase',
    name: 'Coinbase Wallet',
    subtitle: 'Coinbase',
    icon: WALLET_ICONS.coinbase,
    color: '#0052FF',
    detect: () => typeof window !== 'undefined' && !!window.ethereum?.isCoinbaseWallet,
  },
  {
    id: 'rabby',
    name: 'Rabby / Brave',
    subtitle: 'Injected',
    icon: WALLET_ICONS.rabby,
    color: '#7A5CFA',
    detect: () => typeof window !== 'undefined' && (!!window.ethereum && !window.ethereum.isMetaMask && !window.ethereum.isCoinbaseWallet),
  },
];

const SOLANA_WALLETS = [
  {
    id: 'phantom',
    name: 'Phantom',
    subtitle: 'Solana #1',
    icon: WALLET_ICONS.phantom,
    color: '#AB9FF2',
    detect: () => typeof window !== 'undefined' && !!(window.phantom?.solana?.isPhantom || window.solana?.isPhantom),
  },
  {
    id: 'solflare',
    name: 'Solflare',
    subtitle: 'Solana',
    icon: WALLET_ICONS.solflare,
    color: '#FC722D',
    detect: () => typeof window !== 'undefined' && !!(window.solflare?.isSolflare || window.solflare),
  },
  {
    id: 'backpack',
    name: 'Backpack',
    subtitle: 'xNFT',
    icon: WALLET_ICONS.backpack,
    color: '#E33E3E',
    detect: () => typeof window !== 'undefined' && !!window.backpack,
  },
  {
    id: 'glow',
    name: 'Glow',
    subtitle: 'Solana',
    icon: WALLET_ICONS.glow,
    color: '#FFD700',
    detect: () => typeof window !== 'undefined' && !!window.glow,
  },
];

function WalletIcon({ src, color, size = 48 }) {
  const [err, setErr] = useState(false);
  return (
    <div
      className="rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 overflow-hidden"
      style={{ width: size, height: size, background: `${color}15`, border: `1px solid ${color}30` }}
    >
      {!err && src ? (
        <img
          src={src}
          alt="wallet logo"
          style={{ width: size - 8, height: size - 8, objectFit: 'contain' }}
          onError={() => setErr(true)}
        />
      ) : (
        <span style={{ fontSize: size * 0.45 }}>👛</span>
      )}
    </div>
  );
}

export default function WalletModal({ isOpen, onClose, onConnectEVM, onConnectSolana, onAppKitAccount, wallet, showToast }) {
  const [isConnecting, setIsConnecting] = useState(null);
  // wc panel: null | { chain: 'base' | 'solana' }
  const [wc, setWc] = useState(null);
  const [wcUri, setWcUri] = useState('');
  const [wcQr, setWcQr] = useState('');
  const [wcLoading, setWcLoading] = useState(false);
  const [wcErr, setWcErr] = useState('');
  const [wcWallets, setWcWallets] = useState([]);
  const wcSeq = useRef(0);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  // Reset wc panel when modal closes
  useEffect(() => {
    if (!isOpen) {
      setWc(null);
      setWcUri('');
      setWcQr('');
      setWcErr('');
    }
  }, [isOpen]);

  // Forward AppKit account changes (QR / mobile flows) to the app.
  useEffect(() => {
    if (!appKitModal || !onAppKitAccount) return;
    const unsubs = [];
    try {
      unsubs.push(appKitModal.subscribeAccount((acc) => {
        if (acc?.address && acc?.isConnected) {
          onAppKitAccount({ address: acc.address, chain: 'base', type: 'walletconnect' });
        }
      }, 'eip155'));
      unsubs.push(appKitModal.subscribeAccount((acc) => {
        if (acc?.address && acc?.isConnected) {
          onAppKitAccount({ address: acc.address, chain: 'solana', type: 'walletconnect' });
        }
      }, 'solana'));
    } catch (e) {
      console.error('[Ataraxia] subscribeAccount failed:', e);
    }
    return () => { unsubs.forEach(u => { try { u?.(); } catch {} }); };
  }, [onAppKitAccount]);

  // Render QR when URI arrives
  useEffect(() => {
    if (!wcUri) { setWcQr(''); return; }
    QRCode.toDataURL(wcUri, { width: 232, margin: 1, color: { dark: '#0a0a0f', light: '#ffffff' } })
      .then(setWcQr)
      .catch(() => setWcQr(''));
  }, [wcUri]);

  if (!isOpen) return null;

  const openWcPanel = async (chain) => {
    const seq = ++wcSeq.current;
    setWc({ chain });
    setWcUri('');
    setWcQr('');
    setWcErr('');
    setWcLoading(true);
    setWcWallets(FALLBACK_WC[chain]);
    // Wallet directory (non-blocking)
    fetchWcWallets(chain).then((list) => {
      if (wcSeq.current === seq) setWcWallets(list);
    }).catch(() => {});
    // Pairing URI
    try {
      const uri = await startPairing(chain);
      if (wcSeq.current === seq) setWcUri(uri);
    } catch (e) {
      console.error('[Ataraxia] pairing failed:', e);
      if (wcSeq.current === seq) setWcErr(e?.message || 'Gagal membuat tautan');
    } finally {
      if (wcSeq.current === seq) setWcLoading(false);
    }
  };

  const openAppKitFallback = async () => {
    document.body.style.overflow = '';
    onClose?.();
    await new Promise(r => setTimeout(r, 80));
    try {
      await appKitModal?.open();
    } catch (e) {
      showToast?.(e?.message || 'Could not open wallet list', 'error');
    }
  };

  const handleEVM = async (id) => {
    setIsConnecting(id);
    try {
      if (id === 'walletconnect') {
        await openWcPanel('base');
        return;
      }
      if (id === 'baseaccount') {
        const address = await startBaseAccount();
        onAppKitAccount?.({ address, chain: 'base', type: 'baseaccount' });
        return;
      }
      await onConnectEVM(id);
    } catch (e) {
      console.error('[Ataraxia] EVM connect error:', e);
      showToast?.(e.message || 'Connection failed', 'error');
    } finally {
      setIsConnecting(null);
    }
  };

  const handleSolana = async (id) => {
    setIsConnecting(id);
    try {
      if (id === 'walletconnect') {
        await openWcPanel('solana');
        return;
      }
      await onConnectSolana(id);
    } catch (e) {
      console.error('[Ataraxia] Solana connect error:', e);
      showToast?.(e.message || 'Connection failed', 'error');
    } finally {
      setIsConnecting(null);
    }
  };

  const renderWalletBtn = (w, onClick, connected, connecting) => (
    <button
      key={w.id}
      onClick={() => onClick(w.id)}
      disabled={connected || connecting}
      className={`group relative flex flex-col items-center gap-2 p-4 rounded-2xl border text-center transition-all duration-200
        ${connected
          ? 'bg-accent-dim border-accent text-accent shadow-[0_0_20px_var(--color-accent-glow)]'
          : 'bg-bg border-border hover:border-accent/50 hover:bg-bg-elevated hover:shadow-[0_8px_24px_rgba(0,212,170,0.15)] hover:-translate-y-0.5'
        } disabled:opacity-60 disabled:cursor-wait p-0`}
    >
      <WalletIcon src={w.icon} color={w.color} />
      <div>
        <div className="font-semibold text-sm leading-tight">{w.name}</div>
        <div className="text-[11px] text-fg-muted leading-tight">{w.subtitle}</div>
      </div>
      {w.detected && !connected && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-accent animate-pulse" title="Detected in browser" />}
      {connected && <span className="text-[11px] font-medium text-accent">✓ Connected</span>}
      {connecting && <span className="absolute top-2 right-2 w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />}
    </button>
  );

  const wcBtn = (onClick, connecting, dot) => (
    <button
      key="walletconnect"
      onClick={() => onClick('walletconnect')}
      disabled={connecting}
      className="group relative flex flex-col items-center gap-2 p-4 rounded-2xl border text-center transition-all duration-200 bg-bg border-border hover:border-accent/50 hover:bg-bg-elevated hover:shadow-[0_8px_24px_rgba(0,212,170,0.15)] hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-wait p-0"
    >
      <WalletIcon src={WALLET_ICONS.walletconnect} color={dot} />
      <div>
        <div className="font-semibold text-sm leading-tight">WalletConnect</div>
        <div className="text-[11px] text-fg-muted leading-tight">Scan QR / Mobile</div>
      </div>
      {connecting && <span className="absolute top-2 right-2 w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />}
    </button>
  );

  const renderWcPanel = () => {
    const chain = wc.chain;
    const accent = chain === 'base' ? '#0052FF' : '#9945FF';
    return (
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <button
          onClick={() => setWc(null)}
          className="text-xs mb-4 px-3 py-1.5 rounded-full border border-border text-fg-muted hover:border-accent hover:text-accent transition-colors"
        >
          ← Semua wallet
        </button>
        <div className="text-center mb-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: accent }} />
            <h3 className="font-heading text-sm font-semibold tracking-widest uppercase text-fg-muted">
              {chain === 'base' ? 'EVM — Base' : 'Solana'} · Scan / Buka di HP
            </h3>
          </div>
          <p className="text-xs text-fg-muted">Scan QR dengan wallet di HP, atau ketuk salah satu wallet di bawah</p>
        </div>

        {/* QR */}
        <div className="flex justify-center mb-3">
          <div className="p-3 bg-white rounded-2xl shadow-lg">
            {wcQr ? (
              <img src={wcQr} alt="WalletConnect QR" style={{ width: 208, height: 208 }} />
            ) : (
              <div className="flex flex-col items-center justify-center gap-2" style={{ width: 208, height: 208 }}>
                <span className="w-8 h-8 border-2 border-[#0a0a0f] border-t-transparent rounded-full animate-spin" />
                <span className="text-[#0a0a0f] text-xs">{wcLoading ? 'Membuat tautan aman…' : 'Menyiapkan QR…'}</span>
              </div>
            )}
          </div>
        </div>

        {wcErr && (
          <div className="text-center mb-3">
            <p className="text-xs text-red-400 mb-2">{wcErr}</p>
            <button
              onClick={() => openWcPanel(chain)}
              className="text-xs px-4 py-2 rounded-full border border-accent text-accent hover:bg-accent-dim transition-colors"
            >
              ↻ Buat tautan baru
            </button>
          </div>
        )}

        {wcUri && (
          <div className="flex justify-center gap-2 mb-4">
            <button
              onClick={() => { try { navigator.clipboard.writeText(wcUri); showToast?.('Tautan disalin — tempel di wallet HP', 'success'); } catch {} }}
              className="text-xs px-4 py-2 rounded-full border border-border text-fg-muted hover:border-accent hover:text-accent transition-colors"
            >
              📋 Salin tautan
            </button>
            <button
              onClick={() => openWcPanel(chain)}
              className="text-xs px-4 py-2 rounded-full border border-border text-fg-muted hover:border-accent hover:text-accent transition-colors"
            >
              ↻ Tautan baru
            </button>
          </div>
        )}

        {/* Wallet directory with deep links */}
        <p className="text-[11px] tracking-widest uppercase text-fg-muted/70 mb-2 text-center">
          …atau buka langsung di wallet ({wcWallets.length})
        </p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {wcWallets.map((w) => {
            const href = wcUri ? deepLink(w, wcUri) : null;
            const inner = (
              <>
                {w.logo ? (
                  <img src={w.logo} alt={w.name} className="w-9 h-9 rounded-lg object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                ) : (
                  <span className="text-2xl">👛</span>
                )}
                <span className="flex-1 text-left">
                  <span className="block font-semibold text-[13px] leading-tight">{w.name}</span>
                  <span className="block text-[10px] text-fg-muted leading-tight">{href ? 'Ketuk untuk buka ↗' : 'Menunggu tautan…'}</span>
                </span>
              </>
            );
            const cls = 'flex items-center gap-3 p-2.5 rounded-xl border bg-bg border-border text-center transition-all duration-200 hover:-translate-y-0.5 ' +
              (href ? 'hover:border-accent/50 hover:shadow-[0_8px_24px_rgba(0,212,170,0.15)]' : 'opacity-60');
            return href ? (
              <a key={w.name} href={href} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>
            ) : (
              <div key={w.name} className={cls}>{inner}</div>
            );
          })}
        </div>

        <div className="text-center">
          <button onClick={openAppKitFallback} className="text-[11px] text-fg-muted/60 hover:text-accent underline underline-offset-2">
            Buka daftar lengkap di modal Reown →
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#0a0a0f]/80 backdrop-blur-xl" onClick={onClose} />
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/3 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/3 right-1/3 w-72 h-72 bg-accent/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1.5s' }} />
      </div>

      <div className="relative w-full max-w-[520px] max-h-[90vh] overflow-hidden bg-card border border-border rounded-[24px] shadow-[0_20px_60px_rgba(0,0,0,0.5),0_0_0_1px_rgba(0,212,170,0.1)] animate-slideUp flex flex-col">
        <div className="relative px-8 pt-8 pb-6 border-b border-border/50">
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-40 h-40 bg-accent/20 rounded-full blur-3xl pointer-events-none" />
          <button
            onClick={onClose}
            className="absolute top-6 right-6 w-9 h-9 flex items-center justify-center rounded-full bg-bg border border-border text-fg-muted hover:border-accent hover:text-accent transition-colors p-0"
            aria-label="Close"
          >
            <span className="text-lg leading-none">✕</span>
          </button>
          <div className="text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-accent to-[#008a6d] flex items-center justify-center shadow-[0_8px_24px_var(--color-accent-glow)] overflow-hidden">
              <img src="/logo.png" alt="Ataraxia" className="w-10 h-10 object-cover" />
            </div>
            <h2 className="font-heading text-2xl font-bold tracking-tight">Connect Wallet</h2>
            <p className="text-fg-muted text-sm mt-2">Choose your wallet to enter Ataraxia for free</p>
            <p className="text-[11px] text-fg-muted/50 mt-1 font-mono">Reown • Base & Solana • QR supported</p>
          </div>
        </div>

        {wc ? renderWcPanel() : (
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-[#0052FF] animate-pulse" />
              <h3 className="font-heading text-xs font-semibold tracking-widest uppercase text-fg-muted">EVM — Base Chain</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {EVM_WALLETS.map((w) => renderWalletBtn(
                { ...w, detected: w.detect() },
                handleEVM,
                wallet?.chain === 'base' && wallet?.type === w.id,
                isConnecting === w.id,
              ))}
              {wcBtn(handleEVM, isConnecting === 'walletconnect', '#3B99FC')}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border/50" />
            <span className="text-[10px] tracking-widest uppercase text-fg-muted/60">or</span>
            <div className="flex-1 h-px bg-border/50" />
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-[#9945FF] animate-pulse" />
              <h3 className="font-heading text-xs font-semibold tracking-widest uppercase text-fg-muted">Solana</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {SOLANA_WALLETS.map((w) => renderWalletBtn(
                { ...w, detected: w.detect() },
                handleSolana,
                wallet?.chain === 'solana' && wallet?.type === w.id,
                isConnecting === w.id,
              ))}
              {wcBtn(handleSolana, isConnecting === 'walletconnect', '#9945FF')}
            </div>
          </div>
        </div>
        )}

        <div className="px-6 py-4 border-t border-border/50 flex items-center justify-between">
          <span className="text-[11px] text-fg-muted/50">Secured by wallet signature • No seed phrase requested</span>
          <button onClick={onClose} className="text-xs px-4 py-2 rounded-full border border-border text-fg-muted hover:border-accent hover:text-accent transition-colors p-0">Close</button>
        </div>
      </div>
    </div>
  );
}
