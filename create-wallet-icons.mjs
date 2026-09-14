import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';

const outDir = '/home/ubuntu/ataraxia/ataraxia-react/public/wallets';
fs.mkdirSync(outDir, { recursive: true });

const wallets = [
  {
    id: 'metamask',
    bg: '#F6851B',
    fg: '#FFFFFF',
    icon: 'fox',
  },
  {
    id: 'coinbase',
    bg: '#0052FF',
    fg: '#FFFFFF',
    icon: 'coinbase',
  },
  {
    id: 'rainbow',
    bg: '#1A1A1A',
    fg: '#FFFFFF',
    icon: 'rainbow',
  },
  {
    id: 'trust',
    bg: '#3375BB',
    fg: '#FFFFFF',
    icon: 'trust',
  },
  {
    id: 'walletconnect',
    bg: '#3B99FC',
    fg: '#FFFFFF',
    icon: 'wc',
  },
  {
    id: 'rabby',
    bg: '#7084FF',
    fg: '#FFFFFF',
    icon: 'rabby',
  },
  {
    id: 'phantom',
    bg: '#AB9FF2',
    fg: '#FFFFFF',
    icon: 'phantom',
  },
  {
    id: 'solflare',
    bg: '#FC722D',
    fg: '#FFFFFF',
    icon: 'solflare',
  },
  {
    id: 'backpack',
    bg: '#E33E3E',
    fg: '#FFFFFF',
    icon: 'backpack',
  },
  {
    id: 'glow',
    bg: '#FFD700',
    fg: '#1A1A1A',
    icon: 'glow',
  },
];

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawIcon(ctx, type, size) {
  ctx.save();
  const s = size / 100;

  if (type === 'fox') {
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(50 * s, 20 * s);
    ctx.lineTo(20 * s, 35 * s);
    ctx.lineTo(28 * s, 60 * s);
    ctx.lineTo(42 * s, 55 * s);
    ctx.lineTo(50 * s, 70 * s);
    ctx.lineTo(58 * s, 55 * s);
    ctx.lineTo(72 * s, 60 * s);
    ctx.lineTo(80 * s, 35 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#F6851B';
    ctx.beginPath();
    ctx.moveTo(50 * s, 25 * s);
    ctx.lineTo(28 * s, 38 * s);
    ctx.lineTo(50 * s, 55 * s);
    ctx.lineTo(72 * s, 38 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(42 * s, 45 * s, 2.5 * s, 0, Math.PI * 2);
    ctx.arc(58 * s, 45 * s, 2.5 * s, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'coinbase') {
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(50 * s, 50 * s, 25 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0052FF';
    ctx.beginPath();
    ctx.arc(50 * s, 50 * s, 12 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(46 * s, 42 * s, 8 * s, 16 * s);
  } else if (type === 'rainbow') {
    const colors = ['#FF4000', '#FF8C00', '#FFD700', '#00C853', '#0091EA', '#7C4DFF'];
    for (let i = 0; i < colors.length; i++) {
      ctx.strokeStyle = colors[i];
      ctx.lineWidth = 4 * s;
      ctx.beginPath();
      ctx.arc(50 * s, 70 * s, 15 * s + i * 5 * s, Math.PI, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#FFFFFF';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(35 * s + i * 15 * s, 55 * s, 3 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (type === 'trust') {
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(50 * s, 20 * s);
    ctx.lineTo(30 * s, 30 * s);
    ctx.lineTo(30 * s, 50 * s);
    ctx.quadraticCurveTo(30 * s, 70 * s, 50 * s, 80 * s);
    ctx.quadraticCurveTo(70 * s, 70 * s, 70 * s, 50 * s);
    ctx.lineTo(70 * s, 30 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#3375BB';
    ctx.font = `bold ${24 * s}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('T', 50 * s, 52 * s);
  } else if (type === 'wc') {
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 5 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(35 * s, 45 * s, 10 * s, Math.PI, Math.PI * 1.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(65 * s, 45 * s, 10 * s, Math.PI * 1.4, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(30 * s, 60 * s, 10 * s, Math.PI * 0.4, Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(70 * s, 60 * s, 10 * s, 0, Math.PI * 0.6);
    ctx.stroke();
  } else if (type === 'rabby') {
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(35 * s, 40 * s, 3 * s, 0, Math.PI * 2);
    ctx.arc(65 * s, 40 * s, 3 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(50 * s, 60 * s, 18 * s, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.lineWidth = 3 * s;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();
    ctx.fillStyle = '#7084FF';
    ctx.beginPath();
    ctx.ellipse(50 * s, 35 * s, 8 * s, 18 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'phantom') {
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(50 * s, 45 * s, 22 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#AB9FF2';
    ctx.beginPath();
    ctx.arc(40 * s, 42 * s, 4 * s, 0, Math.PI * 2);
    ctx.arc(60 * s, 42 * s, 4 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(40 * s, 42 * s, 2 * s, 0, Math.PI * 2);
    ctx.arc(60 * s, 42 * s, 2 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.quadraticCurveTo(50 * s, 55 * s, 45 * s, 65 * s);
    ctx.quadraticCurveTo(50 * s, 70 * s, 55 * s, 65 * s);
    ctx.quadraticCurveTo(50 * s, 55 * s, 50 * s, 55 * s);
    ctx.fill();
    ctx.fillStyle = '#5346B9';
    ctx.fillRect(38 * s, 80 * s, 24 * s, 4 * s);
  } else if (type === 'solflare') {
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(50 * s, 25 * s);
    ctx.lineTo(70 * s, 45 * s);
    ctx.lineTo(50 * s, 75 * s);
    ctx.lineTo(30 * s, 45 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#FC722D';
    ctx.beginPath();
    ctx.moveTo(50 * s, 35 * s);
    ctx.lineTo(62 * s, 47 * s);
    ctx.lineTo(50 * s, 65 * s);
    ctx.lineTo(38 * s, 47 * s);
    ctx.closePath();
    ctx.fill();
  } else if (type === 'backpack') {
    ctx.fillStyle = '#FFFFFF';
    roundedRect(ctx, 25 * s, 35 * s, 50 * s, 35 * s, 5 * s);
    ctx.fill();
    ctx.fillStyle = '#E33E3E';
    ctx.font = `bold ${16 * s}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('BP', 50 * s, 52 * s);
    ctx.beginPath();
    ctx.arc(50 * s, 25 * s, 5 * s, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'glow') {
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(50 * s, 50 * s, 22 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFD700';
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const x = 50 * s + Math.cos(angle) * 14 * s;
      const y = 50 * s + Math.sin(angle) * 14 * s;
      ctx.beginPath();
      ctx.arc(x, y, 2.5 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

for (const w of wallets) {
  const size = 200;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = w.bg;
  roundedRect(ctx, 0, 0, size, size, size * 0.25);
  ctx.fill();

  drawIcon(ctx, w.icon, size);

  const filename = path.join(outDir, `${w.id}.png`);
  fs.writeFileSync(filename, canvas.toBuffer('image/png'));
  console.log(`Created ${filename}`);
}

console.log(`\nAll ${wallets.length} wallet logos saved to ${outDir}`);