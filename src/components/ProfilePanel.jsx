import { useState } from 'react';

export default function ProfilePanel({ wallet, onDisconnect, onConnect, showToast }) {
  const [name, setName] = useState(() => { try { return localStorage.getItem('ataraxia-profile-name') || ''; } catch { return ''; } });
  const addrFull = wallet?.address || null;
  const network = wallet?.chain || null;

  const saveName = () => {
    try { localStorage.setItem('ataraxia-profile-name', name); } catch {}
    showToast?.('Name saved on this device', 'success');
  };

  if (!wallet) {
    return (
      <main className="flex-1 overflow-y-auto px-4 py-10">
        <div className="max-w-xl mx-auto text-center">
          <p className="text-4xl mb-3">👤</p>
          <h2 className="font-heading text-3xl font-bold tracking-tight mb-3">Profile</h2>
          <p className="text-fg-muted mb-6">Connect your wallet to see your profile.</p>
          <button onClick={onConnect} className="btn-primary text-lg px-8 py-3">🔗 Connect Wallet</button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto px-4 py-8">
      <div className="max-w-xl mx-auto space-y-5">
        <div className="text-center">
          <p className="text-4xl mb-2">👤</p>
          <h2 className="font-heading text-3xl font-bold tracking-tight">Profile</h2>
          <p className="text-fg-muted text-sm mt-1">Free &amp; private — everything stays on this device.</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6">
          <label className="block text-xs uppercase tracking-wide text-fg-muted mb-2">Display name</label>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              maxLength={30}
              className="flex-1 bg-bg border border-border rounded-xl px-3 py-2 text-fg focus:outline-none focus:border-accent"
            />
            <button onClick={saveName} className="btn-primary px-4 py-2 text-sm">Save</button>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 space-y-3">
          <h3 className="font-heading text-lg font-semibold">Wallet</h3>
          <div className="flex justify-between text-sm">
            <span className="text-fg-muted">Address</span>
            <code className="font-mono text-fg break-all text-right max-w-[60%]">{addrFull}</code>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-fg-muted">Network</span>
            <span className="text-fg capitalize">{network || '—'}</span>
          </div>
          <button onClick={onDisconnect} className="w-full mt-2 px-4 py-2.5 rounded-xl border border-danger bg-card text-danger text-sm hover:bg-danger/10 transition-colors">🔌 Disconnect</button>
        </div>

        <p className="text-xs text-fg-muted/70 text-center">
          Ataraxia is free. Your sanctuary progress stays on this device — no account, no tracking.
        </p>
      </div>
    </main>
  );
}