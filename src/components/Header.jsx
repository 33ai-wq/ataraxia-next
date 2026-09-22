import { useState } from 'react';

const NAV = [
  { id: 'breathe', label: 'Breathe', icon: '🫁' },
  { id: 'cinema', label: 'Cinema', icon: '🎬' },
  { id: 'guide', label: 'How it works', icon: '📖' },
];

export default function Header({ active, wallet, onNav, onConnect }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const addr = wallet?.address ? wallet.address.slice(0, 6) + '...' + wallet.address.slice(-4) : null;

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-bg/80 border-b border-border/50">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <button onClick={() => onNav('home')} className="flex items-center gap-3 text-left p-0 bg-transparent border-0">
          <img src="/logo.png" alt="Ataraxia" className="w-9 h-9 md:w-10 md:h-10 drop-shadow-[0_0_15px_rgba(0,212,170,0.4)] flex-shrink-0" />
          <div>
            <div className="font-heading font-bold text-lg md:text-xl tracking-tight bg-gradient-to-r from-fg via-accent to-fg bg-clip-text text-transparent leading-none">ATARAXIA</div>
            <div className="hidden md:block text-[11px] text-fg-muted leading-tight mt-0.5 max-w-[320px]">One quiet room on Base. Breathe. Watch. Exhale</div>
            <div className="md:hidden text-[10px] text-fg-muted leading-none">One quiet room on Base</div>
          </div>
        </button>

        <nav className="hidden lg:flex items-center gap-1">
          {NAV.map(n => (
            <button
              key={n.id}
              onClick={() => onNav(n.id)}
              className={`px-3.5 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 border ${active === n.id ? 'bg-accent-dim border-accent text-accent' : 'bg-transparent border-transparent text-fg-muted hover:text-fg hover:bg-card hover:border-border'}`}
            >
              <span>{n.icon}</span> {n.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {addr ? (
            <span className="hidden md:inline text-xs font-mono text-fg-muted px-3 py-1.5 bg-card border border-border rounded-full">{addr}</span>
          ) : (
            <button onClick={onConnect} className="hidden sm:inline text-xs px-4 py-2 rounded-full border border-border text-fg-muted hover:border-accent hover:text-accent transition-colors">
              Connect wallet
            </button>
          )}
          <span className={`hidden sm:inline-flex w-2.5 h-2.5 rounded-full ${wallet ? 'bg-accent shadow-[0_0_8px_var(--color-accent-glow)]' : 'bg-fg-muted/40'}`} title={wallet ? 'Connected' : 'Not connected'} />

          <div className="lg:hidden relative">
            <button onClick={() => setMenuOpen(o => !o)} className="w-9 h-9 rounded-full bg-card border border-border flex items-center justify-center text-fg-muted">☰</button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-card border border-border rounded-2xl shadow-xl p-2 z-50">
                {NAV.map(n => (
                  <button key={n.id} onClick={() => { onNav(n.id); setMenuOpen(false); }} className={`w-full text-left px-3 py-2.5 rounded-xl text-sm flex items-center gap-2 ${active === n.id ? 'bg-accent-dim text-accent' : 'text-fg-muted hover:bg-bg'}`}>
                    <span>{n.icon}</span> {n.label}
                  </button>
                ))}
                {!addr && (
                  <button onClick={() => { onConnect(); setMenuOpen(false); }} className="w-full text-left px-3 py-2.5 rounded-xl text-sm text-fg-muted hover:bg-bg">
                    🔗 Connect wallet
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
