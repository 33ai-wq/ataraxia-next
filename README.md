# ATARAXIA — Breathing Sanctuary

A wallet-gated breathing sanctuary built with **Vite + React 19 + Tailwind CSS v4**.  
Deployed on VPS (nginx, HTTPS via Let's Encrypt) at **https://ataraxia.xhagents.xyz** — not Vercel.

---

## 🎯 Project Overview

Ataraxia is a minimal breathing sanctuary with three rhythmic patterns:
- **Box** (4-4-6-2) — balanced
- **4-7-8** — deep relaxation (Dr. Weil)
- **Coherent** (5.5-5.5) — optimal heart rhythm

Wallet gating via Reown AppKit (WalletConnect v2) — supports Base, Solana, and Hedera Testnet.

---

## 🛠️ Tech Stack

| Layer | Stack |
|-------|-------|
| Build | Vite 8.x |
| Framework | React 19 |
| Styling | Tailwind CSS v4 (@tailwindcss/vite) |
| State | Zustand (persisted to localStorage) |
| Wallet | Reown AppKit (WalletConnect v2) |
| Networks | Base (EVM), Solana, Hedera Testnet |
| Deploy | nginx + Let's Encrypt on VPS (43.128.111.166) |

---

## 📁 Project Structure

```
ataraxia-next/
├── src/
│   ├── components/      # React components (Header, WalletModal, Sanctuary, Guide, SoundPlayer)
│   ├── lib/             # Utility modules (hedera.js for HTS/HBAR logic)
│   ├── hooks/           # Custom hooks (useAtaraxiaStore)
│   ├── assets/          # Static assets
│   ├── App.jsx          # Main entry: landing + sanctuary + wallet modal
│   ├── Sanctuary.jsx    # Breathing screen with 3 patterns
│   ├── Guide.jsx        # Minimal breathing guide (modal)
│   ├── index.css        # Tailwind v4 + dark theme variables
│   └── main.jsx         # Vite entry
├── public/              # Logo, favicon, wallet icons
├── index.html           # HTML template
├── package.json
├── vite.config.js       # Vite + Tailwind v4 config
├── tailwind.config.js
└── README.md
```

---

## 🚀 Local Development

```bash
# Install dependencies
npm install

# Start dev server (Vite)
npm run dev

# Build for production (outputs to dist/)
npm run build

# Preview production build locally
npm run preview
```

---

## 🌐 Deployment (VPS)

```bash
# 1. Build
npm run build

# 2. Copy to nginx web root
sudo cp -r dist/* /var/www/ataraxia/

# 3. Reload nginx (config at /etc/nginx/sites-available/ataraxia)
sudo nginx -s reload
```

Nginx serves static files with `try_files $uri $uri/ /index.html` for SPA routing.  
TLS via Let's Encrypt (auto-renew via certbot).

---

## 🔗 Wallet Integration

- **Reown AppKit** (WalletConnect v2 project ID: `886f8719c01b034b65dad40b625434a8`)
- **Networks**: Base (chainId 8453), Solana, Hedera Testnet
- **Wallets**: MetaMask, Coinbase, Rainbow, Trust, Phantom, Solflare, Backpack, Glow, HashPack, WalletConnect QR
- **Gating**: Connect wallet → Enter Sanctuary (free)

---

## 💰 Monetization (Testnet)

- **Core breathing** — always FREE (no paywall at entry)
- **Rewards**: HTS token minted on achievement/level-up via `sendPracticeReward()`
- **Premium unlocks**: HBAR micropayments via `payForUnlock()` (soundscape packs, custom themes, custom patterns)
- **Network**: Hedera Testnet (account `0.0.4865075`, EVM `0x510b8dae2b74ab45adb77024c6d424cab8265681`)
- **Mirror Node**: `https://testnet.mirrornode.hedera.com`

---

## 📦 Key Files for Monetization

| File | Purpose |
|------|---------|
| `src/lib/hedera.js` | `sendPracticeReward()`, `payForUnlock()` using `@hashgraph/sdk` |
| `src/hooks/useAtaraxiaStore.ts` | Zustand store — triggers rewards on achievement/level-up |
| `src/components/WalletModal.jsx` | Added `hedera:testnet` namespace + HashPack to WalletConnect flow |
| `.env.local` | Hedera Testnet config (account ID, EVM address, mirror node) |

---

## 📜 License

Private project — XH Agents Exhibition Hall (xhagents.xyz).  
No token, no community, no roadmap. Monetization only via x402 USDC / Hedera testnet micropayments.