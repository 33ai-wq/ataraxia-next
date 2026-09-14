import { useEffect, useState } from 'react';

const PROFILE_AVATAR_KEY = 'ataraxia-profile-avatar';
const PROFILE_NAME_KEY = 'ataraxia-profile-name';

export default function Profile({ wallet, xp, levelName, levelIcon, showToast }) {
  const [avatar, setAvatar] = useState(() => {
    try { return localStorage.getItem(PROFILE_AVATAR_KEY) || ''; } catch { return ''; }
  });
  const [displayName, setDisplayName] = useState(() => {
    try { return localStorage.getItem(PROFILE_NAME_KEY) || ''; } catch { return ''; }
  });
  const [balances, setBalances] = useState({ loading: false, eth: null, usdc: null, sol: null, solUsdc: null, err: '' });
  const [editName, setEditName] = useState(false);
  const [nameInput, setNameInput] = useState(displayName);

  const addr = wallet?.address;
  const chain = wallet?.chain;

  useEffect(() => {
    if (!addr) { setBalances({ loading:false, eth:null, usdc:null, sol:null, solUsdc:null, err:'' }); return; }
    let cancelled = false;
    async function fetchBase() {
      setBalances(s => ({ ...s, loading:true, err:'' }));
      try {
        // viem-like fetch via eth RPC (no viem dep install overhead at runtime if viem missing fallback to fetch)
        const rpc = 'https://mainnet.base.org';
        // eth_getBalance
        const balRes = await fetch(rpc, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ jsonrpc:'2.0', id:1, method:'eth_getBalance', params:[addr,'latest']})}).then(r=>r.json());
        const weiHex = balRes?.result || '0x0';
        const eth = parseInt(weiHex,16) / 1e18;
        // USDC balanceOf(address) -> 0x70a08231 + padded addr ; read via eth_call
        const usdcAddr = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
        const data = '0x70a08231' + addr.slice(2).padStart(64,'0');
        const callRes = await fetch(rpc, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ jsonrpc:'2.0', id:2, method:'eth_call', params:[{ to: usdcAddr, data },'latest']})}).then(r=>r.json());
        const usdcHex = callRes?.result || '0x0';
        const usdc = parseInt(usdcHex,16) / 1e6;
        if (!cancelled) setBalances({ loading:false, eth, usdc, sol:null, solUsdc:null, err:'' });
      } catch(e) {
        if (!cancelled) setBalances({ loading:false, eth:null, usdc:null, sol:null, solUsdc:null, err: e.message });
      }
    }
    async function fetchSol() {
      setBalances(s => ({ ...s, loading:true, err:'' }));
      try {
        const rpc = 'https://api.mainnet-beta.solana.com';
        const balRes = await fetch(rpc, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ jsonrpc:'2.0', id:1, method:'getBalance', params:[addr]})}).then(r=>r.json());
        const lamports = balRes?.result?.value ?? 0;
        const sol = lamports / 1e9;
        // SPL USDC ATA
        const usdcMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
        const tokRes = await fetch(rpc, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ jsonrpc:'2.0', id:2, method:'getTokenAccountsByOwner', params:[addr, { mint: usdcMint }, { encoding:'jsonParsed'}]})}).then(r=>r.json());
        const acc = tokRes?.result?.value?.[0];
        const solUsdc = acc ? Number(acc.account.data.parsed.info.tokenAmount.uiAmount) : 0;
        if (!cancelled) setBalances({ loading:false, eth:null, usdc:null, sol, solUsdc, err:'' });
      } catch(e) {
        if (!cancelled) setBalances({ loading:false, eth:null, usdc:null, sol:null, solUsdc:null, err: e.message });
      }
    }
    if (chain === 'base') fetchBase();
    else if (chain === 'solana') fetchSol();
    else setBalances({ loading:false, eth:null, usdc:null, sol:null, solUsdc:null, err:'' });
    return () => { cancelled = true; };
  }, [addr, chain]);

  const onAvatarPick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2_000_000) { showToast?.('Image too large — max 2MB','error'); return; }
    const r = new FileReader();
    r.onload = () => {
      const dataUrl = r.result;
      try { localStorage.setItem(PROFILE_AVATAR_KEY, dataUrl); } catch {}
      setAvatar(dataUrl);
      showToast?.('Profile picture updated','success');
    };
    r.readAsDataURL(f);
  };

  const saveName = () => {
    const v = nameInput.trim().slice(0,24);
    try { localStorage.setItem(PROFILE_NAME_KEY, v); } catch {}
    setDisplayName(v);
    setEditName(false);
    showToast?.(v ? `Name set to ${v}` : 'Name cleared','success');
  };

  const clearAvatar = () => {
    try { localStorage.removeItem(PROFILE_AVATAR_KEY); } catch {}
    setAvatar('');
    showToast?.('Avatar removed','info');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center py-2">
        <p className="text-3xl mb-2">👤</p>
        <h2 className="font-heading text-3xl font-bold">Profile</h2>
        <p className="text-fg-muted text-sm">Your sanctuary identity — stored only on this device</p>
      </div>

      {/* avatar + name */}
      <section className="bg-card border border-border rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
          <div className="relative group">
            <div className="w-24 h-24 md:w-28 md:h-28 rounded-3xl overflow-hidden bg-bg border border-border flex items-center justify-center">
              {avatar ? <img src={avatar} alt="avatar" className="w-full h-full object-cover" /> : <span className="text-4xl">🫧</span>}
            </div>
            <label className="absolute inset-0 rounded-3xl bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs cursor-pointer transition-opacity">Change</label>
            <input type="file" accept="image/*" onChange={onAvatarPick} className="absolute inset-0 opacity-0 cursor-pointer" title="Upload avatar" />
          </div>
          <div className="flex-1 w-full">
            <div className="flex items-center gap-2 flex-wrap">
              {editName ? (
                <>
                  <input value={nameInput} onChange={e=>setNameInput(e.target.value)} placeholder="Your display name" className="flex-1 min-w-[160px] bg-bg border border-border rounded-full px-4 py-2 text-sm outline-none focus:border-accent" maxLength={24} />
                  <button onClick={saveName} className="px-4 py-2 rounded-full bg-accent text-bg text-sm">Save</button>
                  <button onClick={()=>{setEditName(false); setNameInput(displayName);}} className="px-4 py-2 rounded-full border border-border text-sm text-fg-muted">Cancel</button>
                </>
              ) : (
                <>
                  <h3 className="font-heading text-xl font-semibold">{displayName || 'Anonymous Wanderer'}</h3>
                  <button onClick={()=>setEditName(true)} className="text-xs px-3 py-1 rounded-full border border-border text-fg-muted hover:border-accent hover:text-accent">✎ Edit</button>
                </>
              )}
            </div>
            <p className="text-xs text-fg-muted mt-1">Name and avatar are local only — never uploaded. Max 2MB image.</p>
            <div className="flex gap-2 mt-3 flex-wrap">
              {avatar && <button onClick={clearAvatar} className="text-xs px-3 py-1.5 rounded-full border border-border text-fg-muted hover:border-red-400 hover:text-red-400">Remove avatar</button>}
              <span className="text-xs px-3 py-1.5 rounded-full bg-bg border border-border text-fg-muted">{levelIcon} {levelName} · {xp} XP</span>
            </div>
          </div>
        </div>
      </section>

      {/* wallet status */}
      <section className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading font-semibold">Wallet Status</h3>
          <span className={`text-xs px-3 py-1 rounded-full border ${wallet ? 'bg-accent-dim border-accent text-accent' : 'bg-bg border-border text-fg-muted'}`}>{wallet ? '● Connected' : '○ Not connected'}</span>
        </div>
        {!wallet ? (
          <p className="text-sm text-fg-muted">Not connected. Use the Connect button on Dashboard to enter with Base or Solana.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">{chain==='solana' ? '🟣' : '🔵'}</span>
              <span className="font-mono text-sm break-all">{addr}</span>
              <button onClick={()=>{ try{navigator.clipboard.writeText(addr); showToast?.('Address copied','success');}catch{}}} className="ml-auto text-xs px-3 py-1 rounded-full border border-border hover:border-accent hover:text-accent">📋 Copy</button>
            </div>
            <div className="text-xs text-fg-muted">{chain==='solana' ? 'Solana Mainnet' : 'Base (EVM 8453)'} · {wallet.type}</div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              {chain==='base' ? (
                <>
                  <div className="bg-bg border border-border rounded-xl p-3">
                    <div className="text-[11px] tracking-widest uppercase text-fg-muted">ETH (Base)</div>
                    <div className="font-mono font-semibold">{balances.loading ? '…' : balances.eth==null ? '—' : balances.eth.toFixed(4)}</div>
                    {balances.err && <div className="text-[11px] text-red-400">{balances.err}</div>}
                  </div>
                  <div className="bg-bg border border-border rounded-xl p-3">
                    <div className="text-[11px] tracking-widest uppercase text-fg-muted">USDC (Base)</div>
                    <div className="font-mono font-semibold">{balances.loading ? '…' : balances.usdc==null ? '—' : balances.usdc.toFixed(2)}</div>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-bg border border-border rounded-xl p-3">
                    <div className="text-[11px] tracking-widest uppercase text-fg-muted">SOL</div>
                    <div className="font-mono font-semibold">{balances.loading ? '…' : balances.sol==null ? '—' : balances.sol.toFixed(4)}</div>
                  </div>
                  <div className="bg-bg border border-border rounded-xl p-3">
                    <div className="text-[11px] tracking-widest uppercase text-fg-muted">USDC (Solana)</div>
                    <div className="font-mono font-semibold">{balances.loading ? '…' : balances.solUsdc==null ? '—' : Number(balances.solUsdc).toFixed(2)}</div>
                  </div>
                </>
              )}
            </div>
            <p className="text-[11px] text-fg-muted">Balances fetched read-only via public RPC. No transaction is sent.</p>
          </div>
        )}
      </section>
    </div>
  );
}
