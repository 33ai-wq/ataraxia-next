function Section({ icon, title, tag, children }) {
  return (
    <section className="bg-card border border-border rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading text-xl font-semibold">
          <span className="mr-2">{icon}</span>{title}
        </h2>
        {tag && <span className="text-xs text-fg-muted px-3 py-1 bg-bg rounded-full border border-border/50">{tag}</span>}
      </div>
      <div className="text-fg-muted text-sm md:text-[15px] leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

function Step({ n, title, children }) {
  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-full bg-accent/15 border border-accent/30 text-accent text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{n}</div>
      <div>
        <p className="text-fg font-semibold">{title}</p>
        <div className="mt-1">{children}</div>
      </div>
    </div>
  );
}

export default function Guide({ wallet, onBack, onEnter, showToast }) {
  const addr = wallet?.address ? wallet.address.slice(0, 6) + '...' + wallet.address.slice(-4) : null;
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center py-4">
        <p className="text-4xl mb-3">📖</p>
        <h2 className="font-heading text-3xl md:text-4xl font-bold tracking-tight mb-3">How to Play</h2>
        <p className="text-fg-muted max-w-xl mx-auto">
          Ataraxia is a calm game: breathe, blend sounds, draw in sand, and level up your stillness. Free, private — all progress stays on your device.
        </p>
      </div>

      <Section icon="🔗" title="1. Connect Wallet" tag="Gateway">
        <div className="space-y-4">
          <Step n="1" title="Tap Enter Sanctuary / Connect Wallet">
            <p>A wallet modal opens with two networks: <b className="text-fg">EVM — Base Chain</b> <span className="text-fg-muted">(blue)</span> and <b className="text-fg">Solana</b> <span className="text-fg-muted">(purple)</span>. Pick one.</p>
          </Step>
          <Step n="2" title="Browser wallet (easiest)">
            <p>Tap a wallet card (MetaMask, Phantom, etc.). Your browser asks to <b className="text-fg">Approve / Connect</b> — confirm. A green dot <span className="text-accent">●</span> means the wallet is detected.</p>
          </Step>
          <Step n="3" title="Phone wallet (Scan QR / Mobile)">
            <p>Tap <b className="text-fg">WalletConnect</b> → QR panel appears. <b className="text-fg">Scan the QR</b> with your phone wallet, or tap a wallet in the list — the app opens and asks for approval. You enter Sanctuary instantly after approval.</p>
          </Step>
          <Step n="4" title="Nothing happens?">
            <p>Check: (a) wallet extension installed & unlocked, (b) for QR — phone online, (c) tap <b className="text-fg">↻ New link</b> if QR expired, or <b className="text-fg">📋 Copy link</b> and paste in your phone wallet.</p>
          </Step>
          <p className="text-xs border-t border-border/50 pt-3">🔒 Ataraxia never asks for your seed phrase. Connecting only proves address ownership — no fee, no transaction.</p>
        </div>
      </Section>

      <Section icon="🫁" title="2. Breathing Guide" tag="+10 XP / cycle">
        <div className="space-y-4">
          <Step n="1" title="Follow the circle">
            <p>Circle <b className="text-fg">expands = inhale</b>, <b className="text-fg">shrinks = exhale</b>, <b className="text-fg">still = hold</b>. Labels Inhale / Hold / Exhale light up.</p>
          </Step>
          <Step n="2" title="Pick a pattern">
            <p><b className="text-fg">Box</b> (4-4-6-2, balanced) · <b className="text-fg">4-7-8</b> (deep relaxation, Dr. Weil) · <b className="text-fg">Coherent</b> (5.5-5.5, optimal heart rhythm). Switch anytime.</p>
          </Step>
          <Step n="3" title="Tap core to restart">
            <p>Tap the center circle to restart the cycle. Every <b className="text-fg">full cycle = +10 XP</b> and +1 breath in Journey.</p>
          </Step>
        </div>
      </Section>

      <Section icon="🎧" title="3. Ambient Soundscape" tag="Sound mixer">
        <div className="space-y-4">
          <Step n="1" title="Turn on layers">
            <p>Hit play on <b className="text-fg">Rain, Wind, Singing Bowl,</b> or <b className="text-fg">Low Drone</b>. Sound is generated live via Web Audio — no files, no loading.</p>
          </Step>
          <Step n="2" title="Blend the mix">
            <p>Use each slider to blend (e.g. heavy rain + thin drone). Turn on <b className="text-fg">2 sounds together</b> to unlock <b className="text-fg">🎧 Sound Weaver</b>.</p>
          </Step>
        </div>
      </Section>

      <Section icon="🎨" title="4. Zen Garden" tag="+XP sand">
        <div className="space-y-4">
          <Step n="1" title="Draw with finger / mouse">
            <p>Drag on the sand canvas. Tools: <b className="text-fg">🌾 Rake</b> (wide), <b className="text-fg">⭕ Circle</b>, <b className="text-fg">⬤ Dot</b>, <b className="text-fg">🗑️ Clear</b> (tap once).</p>
          </Step>
          <Step n="2" title="Every grain counts">
            <p>Every <b className="text-fg">50 grains = +2 XP</b>. Scatter 1,000 to unlock <b className="text-fg">🎨 Zen Artist</b>.</p>
          </Step>
        </div>
      </Section>

      <Section icon="🌱" title="5. Journey of Stillness" tag="The game">
        <div className="space-y-3">
          <p><b className="text-fg">Levels:</b> 🌱 Seed of Calm (0) → 🌿 Sprout (100) → 🌳 Still Grove (250) → 🏞️ Mirror Lake (500) → ⛰️ Silent Mountain (1000) → 🌊 Boundless Ocean (2000 XP).</p>
          <p><b className="text-fg">Streak:</b> open Sanctuary daily to keep a 🔥 streak. Two days in a row unlocks <b className="text-fg">🌅 Returning Soul</b>.</p>
          <p><b className="text-fg">Intention:</b> write one intention for today (e.g. “breathe before replying”) then hit Set 🧭 — unlocks <b className="text-fg">🧭 Set Sail</b>.</p>
          <p><b className="text-fg">Achievements:</b> 8 core only — 🫁 First Breath, 🔥 Steady Rhythm (10), 💎 Deep Diver (50), ⏳ Still Water (5min), 🎨 Zen Artist (1000 grains), 🎧 Sound Weaver (2 sounds), 🌅 Returning Soul, 🧭 Set Sail. See Levels page — locked dimmed, calm over grind.</p>
          <p className="text-xs border-t border-border/50 pt-3">💾 All progress is in localStorage on your device. Change browser / clear data = restart at Seed. No account, no server, no tracking.</p>
        </div>
      </Section>

      <Section icon="👤" title="6. Account & Safety" tag="Profile">
        <div className="space-y-3">
          <p>Tap your <b className="text-fg">address chip</b> in the header or open <b className="text-fg">Profile</b> to see full address, network, live balances (ETH/USDC or SOL/USDC), upload your avatar, and <b className="text-fg">🔌 Disconnect</b>.</p>
          <p>Disconnecting clears the WalletConnect session and returns you to Dashboard. Journey progress stays safe on device.</p>
        </div>
      </Section>

      <Section icon="🎁" title="7. Rewards" tag="1000 XP = $0.10">
        <p>Every 1000 XP = $0.10 USDC claimable (see Reward page). Earn XP by breathing, drawing, listening. Claims are queued locally and paid from treasury during beta — no gas needed.</p>
      </Section>

      <div className="text-center py-4">
        <button
          onClick={() => {
            if (!wallet) { onEnter(); showToast?.('Connect wallet to enter', 'info'); }
            else onBack();
          }}
          className="btn-primary text-lg px-10 py-4"
        >
          {wallet ? '← Back to Sanctuary' : '🔗 Connect & Enter Sanctuary'}
        </button>
      </div>
    </div>
  );
}
