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

export default function Guide({ wallet, onBack, onEnter, onCinema }) {
  const addr = wallet?.address ? wallet.address.slice(0, 6) + '...' + wallet.address.slice(-4) : null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center py-4">
        <p className="text-4xl mb-3">📖</p>
        <h2 className="font-heading text-3xl md:text-4xl font-bold tracking-tight mb-3">How Ataraxia works</h2>
        <p className="text-fg-muted max-w-xl mx-auto">
          Ataraxia is a quiet room, not a game. No levels, no points, no streaks, no token — nothing to grind and nothing to lose.
          Every part of it is either free calm, or a film you choose to buy once.
        </p>
      </div>

      <Section icon="🔗" title="1. Connect a wallet" tag="Your only key">
        <div className="space-y-4">
          <Step n="1" title="Any Base wallet, or scan the QR">
            MetaMask, Coinbase Wallet, Base Account, or any WalletConnect-compatible wallet. No sign-up, no email.
          </Step>
          <Step n="2" title="The wallet is the account">
            Your address identifies what you own; nothing else about you is stored. Disconnect any time with the 🔌 button.
          </Step>
          <Step n="3" title="Only ever a signature, never a seed phrase">
            Ataraxia never asks for a recovery phrase, and no funds move unless you approve a transfer in your own wallet.
          </Step>
        </div>
      </Section>

      <Section icon="🫁" title="2. Breathe" tag="Free, forever">
        <div className="space-y-4">
          <Step n="1" title="Pick a pattern">
            Box (4-4-6-2), 4-7-8, or Coherent (5.5-5.5). The circle expands as you inhale, holds, then shrinks as you exhale.
          </Step>
          <Step n="2" title="Follow the labels">
            Inhale / Hold / Exhale light up as the phase changes. Tap the core to restart, or pause whenever you like.
          </Step>
          <Step n="3" title="Nothing is counted">
            No score, no progress bar, no reward for minutes spent. Leaving early is a perfectly good way to use it.
          </Step>
        </div>
      </Section>

      <Section icon="🎬" title="3. Cinema" tag="0.10 USDC per film">
        <div className="space-y-4">
          <Step n="1" title="Preview first, free">
            Every film shows a 5-second loop immediately, and that preview stays free forever.
          </Step>
          <Step n="2" title="Unlock the 109-second version">
            The full film is the same animation stretched 21× longer for slow viewing. One transfer of 0.10 USDC on Base unlocks it
            for that wallet, on any device, permanently.
          </Step>
          <Step n="3" title="What actually happens when you pay">
            (a) Press Unlock. (b) Your wallet sends one plain USDC transfer on Base — you approve it. (c) Our server reads the receipt on
            Base and checks that it came from your wallet, to the Ataraxia treasury, in the right token and amount. (d) Only then does
            the full film stream to you.
          </Step>
          <Step n="4" title="Sign in (free) to restore your unlocks">
            Signing one message proves the wallet is yours. It costs nothing and sends no transaction. That is how the page knows what
            you already own after a refresh, or on another device.
          </Step>
        </div>
      </Section>

      <Section icon="🔒" title="4. Privacy & safety" tag="No tracking">
        <ul className="list-disc pl-5 space-y-2">
          <li>No analytics. The only cookie is the one that holds your sign-in.</li>
          <li>The 109-second masters are not publicly hosted — they are streamed only to wallets recorded as paid.</li>
          <li>Payment goes straight to the treasury wallet as a normal on-chain transfer. Ataraxia never holds your funds.</li>
          <li>If a payment cannot be verified, nothing unlocks: the app fails closed instead of guessing.</li>
        </ul>
      </Section>

      <Section icon="🛠" title="5. If something looks stuck" tag="Troubleshooting">
        <ul className="list-disc pl-5 space-y-2">
          <li><b className="text-fg">Nothing happens on connect:</b> unlock the wallet extension and reload. On mobile use WalletConnect → scan the QR, or open this page inside your wallet's browser.</li>
          <li><b className="text-fg">Wrong network:</b> the app asks the wallet to switch to Base (chain 8453) automatically.</li>
          <li><b className="text-fg">Paid but still locked:</b> sign in again so the page re-reads your unlocks — verification is done from the on-chain receipt, never from a browser claim.</li>
          <li><b className="text-fg">Video does not start:</b> the full film streams only after the unlock is confirmed; on data-saving mobile browsers, tap play once.</li>
        </ul>
      </Section>

      <div className="flex flex-wrap items-center justify-center gap-3 pb-6">
        <button onClick={onEnter} className="btn-primary px-8 py-3">
          <span className="flex items-center gap-2"><span>🫁</span><span>Breathe</span></span>
        </button>
        <button onClick={onCinema} className="text-sm px-6 py-3 rounded-full border border-border text-fg-muted hover:border-accent hover:text-accent transition-all">
          🎬 Open Cinema
        </button>
        <button onClick={onBack} className="text-sm px-6 py-3 rounded-full border border-border text-fg-muted hover:border-accent hover:text-accent transition-all">
          ← Back home
        </button>
        {addr && <span className="text-xs font-mono text-fg-muted/70">{addr}</span>}
      </div>
    </div>
  );
}
