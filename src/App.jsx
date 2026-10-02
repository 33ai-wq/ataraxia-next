import { useState, useEffect, useCallback } from 'react';
import Sanctuary from './Sanctuary';
import WalletModal, { disconnectAppKit } from './components/WalletModal';
import Guide from './Guide';
import Header from './components/Header';
import Cinema from './pages/Cinema';
import Rewards from './pages/Rewards';

const PRICE_LABEL = '0.10 USDC';

function App() {
  const [phase, setPhase] = useState('home'); // home | breathe | cinema | guide
  const [wallet, setWallet] = useState(null); // { type, address, chain }
  const [toast, setToast] = useState({ message: '', type: 'info', show: false });
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type, show: true });
    setTimeout(() => setToast({ message: '', type: 'info', show: false }), 4000);
  }, []);

  const formatAddress = (addr) => {
    if (!addr) return '';
    return addr.slice(0, 6) + '...' + addr.slice(-4);
  };

  const resetFlow = useCallback(() => {
    setWallet(null);
    setPhase('home');
    setIsWalletModalOpen(false);
  }, []);

  const handleDisconnect = useCallback(async () => {
    try { await disconnectAppKit(); } catch {}
    try { await window.phantom?.solana?.disconnect?.(); } catch {}
    try { await window.solana?.disconnect?.(); } catch {}
    resetFlow();
    showToast('Wallet disconnected — see you in stillness', 'info');
  }, [resetFlow, showToast]);

  // ---- wallet connect ----
  const connectMetaMask = async (id = 'metamask') => {
    try {
      const eth = window.ethereum;
      if (!eth) throw new Error('Wallet not found. Install MetaMask / Base Account or use WalletConnect → Scan QR');
      let accounts;
      try {
        accounts = await eth.request({ method: 'eth_requestAccounts' });
      } catch (e) {
        if (e?.code === 4001) throw new Error('Connection rejected — please approve in wallet');
        throw e;
      }
      if (!accounts || !accounts.length) throw new Error('No accounts returned — unlock wallet and try again');
      const addr = accounts[0];
      try {
        await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x2105' }] });
      } catch (switchErr) {
        if (switchErr?.code === 4902) {
          try {
            await eth.request({
              method: 'wallet_addEthereumChain',
              params: [{ chainId: '0x2105', chainName: 'Base', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: ['https://mainnet.base.org'], blockExplorerUrls: ['https://basescan.org'] }]
            });
          } catch {}
        }
      }
      setWallet({ type: id, address: addr, chain: 'base' });
      setIsWalletModalOpen(false);
      showToast(`Connected: ${formatAddress(addr)}`, 'success');
    } catch (e) {
      showToast(e.message || 'Connection failed', 'error');
      throw e;
    }
  };

  const connectPhantom = async (id = 'phantom') => {
    try {
      let provider = null;
      if (id === 'phantom') provider = window.phantom?.solana || window.solana;
      else if (id === 'solflare') provider = window.solflare || window.solflare?.solana;
      else if (id === 'backpack') provider = window.backpack;
      else if (id === 'glow') provider = window.glow;
      if (!provider) provider = window.phantom?.solana || window.solana || window.solflare || window.backpack || window.glow;
      if (!provider) throw new Error(`${id} not installed — install Phantom / Solflare or use WalletConnect`);
      let resp;
      try {
        if (provider.isPhantom || provider.isPhantom === undefined) {
          resp = await provider.connect({ onlyIfTrusted: false });
        } else {
          resp = await provider.connect?.();
          if (!resp) resp = await provider.connect({ onlyIfTrusted: false });
        }
      } catch (e) {
        if (e?.message?.includes('User rejected')) throw new Error('Connection rejected — please approve in wallet');
        throw e;
      }
      const addr = resp?.publicKey?.toString?.() || resp?.toString?.() || provider.publicKey?.toString?.() || '';
      if (!addr || addr.length < 20) throw new Error('No publicKey returned — try unlocking wallet first');
      setWallet({ type: id, address: addr, chain: 'solana' });
      setIsWalletModalOpen(false);
      showToast(`Connected: ${formatAddress(addr)}`, 'success');
    } catch (e) {
      showToast(e.message || 'Connection failed', 'error');
      throw e;
    }
  };

  const handleAppKitAccount = useCallback(({ address, chain, type }) => {
    if (!address) return;
    setWallet((prev) => {
      if (prev?.address === address && prev?.chain === chain) return prev;
      return { type: type || 'walletconnect', address, chain: chain || 'base' };
    });
    setIsWalletModalOpen(false);
    showToast(`Connected: ${formatAddress(address)}`, 'success');
  }, [showToast]);

  // Gate: the free rooms need a wallet; Cinema can be opened to attach one.
  const requestWallet = useCallback((next) => {
    if (!wallet) {
      setIsWalletModalOpen(true);
      return;
    }
    setPhase(next);
  }, [wallet]);

  // listen to injected EVM account/chain changes to stay in sync
  useEffect(() => {
    const eth = window.ethereum;
    if (!eth?.on) return;
    const onAccounts = (accs) => {
      if (!accs || accs.length === 0) { handleDisconnect(); return; }
      setWallet(w => w ? { ...w, address: accs[0] } : w);
    };
    const onChain = () => { /* keep wallet, Base switch already handled in connect */ };
    eth.on('accountsChanged', onAccounts);
    eth.on('chainChanged', onChain);
    return () => { try { eth.removeListener('accountsChanged', onAccounts); eth.removeListener('chainChanged', onChain); } catch {} };
  }, [handleDisconnect]);

  const renderMain = () => {
    if (phase === 'guide') {
      return <main className="flex-1 overflow-y-auto px-4 py-6"><Guide wallet={wallet} onBack={() => setPhase('home')} onEnter={() => requestWallet('breathe')} onCinema={() => setPhase('cinema')} /></main>;
    }
    if (phase === 'breathe') {
      return <Sanctuary wallet={wallet} />;
    }
    if (phase === 'cinema') {
      return <Cinema wallet={wallet} onBack={() => setPhase('home')} onRewards={() => setPhase('rewards')} showToast={showToast} />;
    }
    if (phase === 'rewards') {
      return <Rewards onBack={() => setPhase('home')} showToast={showToast} />;
    }

    // home
    return (
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/3 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
        </div>
        <div className="relative z-10 text-center max-w-3xl mx-auto">
          <img src="/logo.png" alt="Ataraxia" className="w-24 h-24 md:w-32 md:h-32 mx-auto mb-4 drop-shadow-[0_0_30px_rgba(0,212,170,0.4)] animate-fade-in" />
          <h1 className="font-heading text-5xl md:text-7xl font-bold tracking-tight mb-4 bg-gradient-to-r from-fg via-accent to-fg bg-clip-text text-transparent animate-fade-in">
            Ataraxia
          </h1>
          <p className="text-fg-muted text-lg md:text-xl mb-3">One quiet room on Base.</p>
          <p className="text-fg-muted text-base mb-10 max-w-xl mx-auto leading-relaxed">
            Breathe for free. Watch the long animations when you want more quiet. No levels, no streaks, no token.
          </p>

          <div className="grid gap-4 md:grid-cols-2 mb-8 text-left">
            <button onClick={() => requestWallet('breathe')} className="bg-card border border-border rounded-2xl p-6 hover:border-accent/40 transition-colors text-left">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/20 flex items-center justify-center text-lg">🫁</span>
                <h2 className="font-heading text-xl font-bold">Breathe</h2>
                <span className="ml-auto text-[11px] px-2 py-1 rounded-full bg-accent/10 text-accent border border-accent/20">free</span>
              </div>
              <p className="text-fg-muted text-sm leading-relaxed">
                Box, 4-7-8 and Coherent patterns on one circle. Nothing to win, nothing to keep track of.
              </p>
            </button>

            <button onClick={() => setPhase('cinema')} className="bg-card border border-border rounded-2xl p-6 hover:border-accent/40 transition-colors text-left">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/20 flex items-center justify-center text-lg">🎬</span>
                <h2 className="font-heading text-xl font-bold">Cinema</h2>
                <span className="ml-auto text-[11px] px-2 py-1 rounded-full bg-card text-fg-muted border border-border">{PRICE_LABEL} · Base</span>
              </div>
              <p className="text-fg-muted text-sm leading-relaxed">
                Four XH Animations, each stretched 21× to 109 seconds. Preview any of them free-forever, unlock the long version once.
                25% of what you pay comes back to your wallet automatically.
              </p>
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button onClick={() => requestWallet('breathe')} className="btn-primary text-base px-8 py-3.5">
              <span className="flex items-center gap-2"><span className="text-xl">🫁</span><span>Enter the room</span></span>
            </button>
            <button onClick={() => setPhase('guide')} className="text-sm px-6 py-3 rounded-full border border-border text-fg-muted hover:border-accent hover:text-accent transition-all">
              📖 How it works
            </button>
          </div>
          {!wallet && <p className="mt-5 text-xs text-fg-muted/60">A wallet is the only key — no email, no account, no tracking.</p>}
        </div>
      </main>
    );
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {toast.show && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slideUp">
          <div className={`px-6 py-3 rounded-xl border shadow-xl text-sm ${toast.type === 'success' ? 'border-accent bg-card' : toast.type === 'error' ? 'border-danger bg-card' : 'border-border bg-card'}`}>
            {toast.message}
          </div>
        </div>
      )}

      <Header
        active={phase}
        wallet={wallet}
        onNav={(id) => {
          if (id === 'home') { setPhase('home'); return; }
          if (id === 'cinema') { setPhase('cinema'); return; }
          if (id === 'breathe') { requestWallet('breathe'); return; }
          setPhase(id);
        }}
        onConnect={() => setIsWalletModalOpen(true)}
      />

      {renderMain()}

      <WalletModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        onConnectEVM={connectMetaMask}
        onConnectSolana={connectPhantom}
        onAppKitAccount={handleAppKitAccount}
        wallet={wallet}
        showToast={showToast}
      />

      <footer className="py-6 px-4 border-t border-border/50">
        <p className="text-center text-xs text-fg-muted">
          ATARAXIA: Peace of Mind •{' '}
          <a href="https://xhagents.xyz" target="_blank" rel="noopener noreferrer" className="hover:text-accent">xhagents.xyz</a>
          {' '}• Quiet by design • Built on Base
        </p>
      </footer>
    </div>
  );
}

export default App;
