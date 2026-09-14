const { createCanvas } = require('canvas');
const fs = require('fs');

const size = 600;
const canvas = createCanvas(size, size);
const ctx = canvas.getContext('2d');

// Dark background
ctx.fillStyle = '#0a0a0f';
ctx.fillRect(0, 0, size, size);

// Gradient circle background
const gradient = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2 * 0.8);
gradient.addColorStop(0, '#00d4aa');
gradient.addColorStop(0.5, '#008a6d');
gradient.addColorStop(1, '#004d3a');

ctx.beginPath();
ctx.arc(size/2, size/2, size/2 * 0.8, 0, Math.PI * 2);
ctx.fillStyle = gradient;
ctx.fill();

// Outer glow ring
ctx.beginPath();
ctx.arc(size/2, size/2, size/2 * 0.82, 0, Math.PI * 2);
ctx.strokeStyle = 'rgba(0, 212, 170, 0.4)';
ctx.lineWidth = 4;
ctx.stroke();

// Inner subtle ring
ctx.beginPath();
ctx.arc(size/2, size/2, size/2 * 0.75, 0, Math.PI * 2);
ctx.strokeStyle = 'rgba(0, 212, 170, 0.2)';
ctx.lineWidth = 2;
ctx.stroke();

// Yin-Yang symbol (Ataraxia's symbol)
const centerX = size/2;
const centerY = size/2;
const radius = size/2 * 0.55;

// Draw Yin-Yang
ctx.save();
ctx.translate(centerX, centerY);

// Upper half (white/light)
ctx.beginPath();
ctx.arc(0, -radius/2, radius/2, 0, Math.PI);
ctx.arc(0, radius/2, radius/2, Math.PI, Math.PI * 2);
ctx.arc(0, 0, radius, Math.PI, 0);
ctx.fillStyle = '#f0f0f5';
ctx.fill();

// Lower half (dark)
ctx.beginPath();
ctx.arc(0, radius/2, radius/2, 0, Math.PI);
ctx.arc(0, -radius/2, radius/2, Math.PI, Math.PI * 2);
ctx.arc(0, 0, radius, 0, Math.PI);
ctx.fillStyle = '#1a1612';
ctx.fill();

// Small circles
// Upper small circle (dark)
ctx.beginPath();
ctx.arc(0, -radius/2, radius/6, 0, Math.PI * 2);
ctx.fillStyle = '#1a1612';
ctx.fill();

// Lower small circle (light)
ctx.beginPath();
ctx.arc(0, radius/2, radius/6, 0, Math.PI * 2);
ctx.fillStyle = '#f0f0f5';
ctx.fill();

// Subtle accent glow on the light side
ctx.beginPath();
ctx.arc(0, -radius/2, radius/2 + 8, -Math.PI/3, Math.PI/3);
ctx.strokeStyle = 'rgba(0, 212, 170, 0.3)';
ctx.lineWidth = 3;
ctx.stroke();

ctx.restore();

// Subtle particles/sparkles around
for (let i = 0; i < 12; i++) {
  const angle = (i / 12) * Math.PI * 2;
  const r = size/2 * 0.88;
  const x = centerX + Math.cos(angle) * r;
  const y = centerY + Math.sin(angle) * r;
  const particleSize = Math.random() * 3 + 1;
  
  ctx.beginPath();
  ctx.arc(x, y, particleSize, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(0, 212, 170, ${0.3 + Math.random() * 0.4})`;
  ctx.fill();
}

// Save PNG
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync('/home/ubuntu/ataraxia/ataraxia-react/public/logo.png', buffer);
console.log('Logo created: /home/ubuntu/ataraxia/ataraxia-react/public/logo.png');
