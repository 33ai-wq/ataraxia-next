import { useState, useEffect, useCallback } from 'react';
import Sanctuary from './Sanctuary';
import WalletModal, { disconnectAppKit } from './components/WalletModal';
import Guide from './Guide';
import Header from './components/Header';

const CONFIG = {
  base: {
    chainId: 8453,
    name: 'Base',
    rpc: 'https://mainnet.base.org',
    usdcAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    usdcDecimals: 6,
    treasuryAddress: '0x57EEC52d76A4A78D4562fc2564101A4bD2e3F357',
    explorer: 'https://basescan.org/tx/'
  },
  solana: {
    name: 'Solana',
    rpc: 'https://api.mainnet-beta.solana.com',
    usdcMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    usdcDecimals: 6,
    treasuryAddress: 'GhFbGgNxERN6pQ7boSFLFJuPwXJuvJ8Tx7EgoJ9LV2Aw',
    explorer: 'https://solscan.io/tx/'
  },
  hedera: {
    name: 'Hedera',
    network: 'testnet',
    rpc: 'https://testnet.hashio.io/api',
    mirrorNode: 'https://testnet.mirrornode.hedera.com',
    treasuryAccountId: '0.0.4865075',
    explorer: 'https://hashscan.io/testnet/tx/'
  }
};

function App() {
  const [phase, setPhase] = useState('landing'); // landing | sanctuary | guide
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
    setPhase('landing');
    setIsWalletModalOpen(false);
  }, []);

  const handleDisconnect = useCallback(async () => {
    try { await disconnectAppKit(); } catch {}
    try { await window.phantom?.solana?.disconnect?.(); } catch {}
    try { await window.solana?.disconnect?.(); } catch {}
    resetFlow();
    showToast('Wallet disconnected — see you in stillness', 'info');
  }, [resetFlow, showToast]);

  // ---- wallet connect fixes ----
  const connectMetaMask = async (id = 'metamask') => {
    try {
      const eth = window.ethereum;
      if (!eth) throw new Error('Wallet not found. Install MetaMask / Coinbase Wallet or use WalletConnect → Scan QR');
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
      setPhase('sanctuary');
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
      setPhase('sanctuary');
      showToast(`Connected: ${formatAddress(addr)}`, 'success');
    } catch (e) {
      showToast(e.message || 'Connection failed', 'error');
      throw e;
    }
  };

  const handleEnterSanctuary = () => {
    if (!wallet) {
      setIsWalletModalOpen(true);
    } else {
      setPhase('sanctuary');
      showToast('Welcome to Ataraxia', 'success');
    }
  };

  const handleAppKitAccount = useCallback(({ address, chain, type }) => {
    if (!address) return;
    setWallet((prev) => {
      if (prev?.address === address && prev?.chain === chain) return prev;
      return { type: type || 'walletconnect', address, chain: chain || 'base' };
    });
    setIsWalletModalOpen(false);
    setPhase('sanctuary');
    showToast(`Connected: ${formatAddress(address)}`, 'success');
  }, [showToast]);

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
      return <div className="flex-1 overflow-y-auto px-4 py-6"><Guide wallet={wallet} onBack={() => setPhase(wallet ? 'sanctuary' : 'landing')} onEnter={handleEnterSanctuary} showToast={showToast} /></div>;
    }
    if (phase === 'sanctuary') {
      return <Sanctuary wallet={wallet} onExit={resetFlow} onDisconnect={handleDisconnect} onGuide={() => setPhase('guide')} showToast={showToast} />;
    }
    // landing
    return (
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden min-h-[calc(100vh-200px)]">
        {/* Ambient glow background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/3 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
        </div>
        <div className="relative z-10 text-center max-w-2xl mx-auto">
          <div className="mb-6">
            <img src="/logo.png" alt="Ataraxia" className="w-24 h-24 md:w-32 md:h-32 mx-auto mb-4 drop-shadow-[0_0_30px_rgba(0,212,170,0.4)] animate-fade-in" />
            <h1 className="font-heading text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-gradient-to-r from-fg via-accent to-fg bg-clip-text text-transparent animate-fade-in">
              Ataraxia
            </h1>
          </div>
          <p className="text-fg-muted text-lg md:text-xl mb-4 max-w-xl mx-auto">A wallet-gated breathing sanctuary.</p>
          <p className="text-fg-muted text-base md:text-lg mb-10 max-w-2xl mx-auto leading-relaxed">
            Three patterns. One circle. Pure breath.
          </p>
          <div className="mb-10 w-full max-w-xl mx-auto">
            <div className="bg-card border border-border rounded-2xl p-6 md:p-8 text-left shadow-[0_8px_32px_rgba(0,0,0,0.3)] hover:border-accent/30 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">🫁</span>
                </div>
                <h2 className="font-heading text-xl md:text-2xl font-bold tracking-tight">Breathing Sanctuary</h2>
              </div>
              <p className="text-fg-muted text-sm md:text-[15px] leading-relaxed mb-4">
                Choose a pattern: <span className="text-fg font-semibold">Box</span> (4-4-6-2), <span className="text-fg font-semibold">4-7-8</span>, or <span className="text-fg font-semibold">Coherent</span> (5.5-5.5).
              </p>
              <p className="text-fg-muted text-sm md:text-[15px] leading-relaxed mb-4">
                Follow the animated circle as it expands, holds, shrinks, and holds. Phase labels guide each step.
              </p>
              <p className="text-accent text-sm font-medium mb-6">Connect your wallet to enter the sanctuary.</p>
              <button onClick={handleEnterSanctuary} className="w-full btn-primary py-3 flex items-center justify-center gap-2 group">
                <span>🔗</span>
                <span>Connect Wallet</span>
                <span className="group-hover:translate-x-0.5 transition-transform">→</span>
              </button>
            </div>
          </div>
          <button onClick={handleEnterSanctuary} className="btn-primary text-lg px-10 py-4 shadow-[0_0_0_0_var(--color-accent-glow)] hover:shadow-[0_8px_32px_var(--color-accent-glow)] transition-all duration-300 group">
            <span className="flex items-center gap-3">
              <span className="text-2xl">🫁</span>
              <span>Enter Sanctuary</span>
            </span>
          </button>
          <p className="mt-6 text-xs text-fg-muted/60 max-w-xs mx-auto">Connect wallet → Enter Sanctuary for free</p>
          <button onClick={() => setPhase('guide')} className="mt-4 text-sm px-6 py-2.5 rounded-full border border-border text-fg-muted hover:border-accent hover:text-accent transition-all">
            📖 Breathing Guide
          </button>
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

      <Header wallet={wallet} onDisconnect={handleDisconnect} />

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
          <a href="https://xhagents.xyz" target="_blank" rel="noopener noreferrer" className="hover:text-accent">
            xhagents.xyz
          </a>{' '}
          • Free • Wallet-gated
        </p>
      </footer>
    </div>
  );
}

export default App;