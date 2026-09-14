import { createCanvas } from 'canvas';
import fs from 'fs';

const size = 600;
const canvas = createCanvas(size, size);
const ctx = canvas.getContext('2d');

// Dark background
ctx.fillStyle = '#0a0a0f';
ctx.fillRect(0, 0, size, size);

// Create breathing circle as the main logo
const centerX = size / 2;
const centerY = size / 2;
const outerRadius = size * 0.38;

// Subtle ambient glow rings (multiple layers for depth)
for (let i = 0; i < 6; i++) {
  const radius = outerRadius + i * 12;
  const alpha = 0.03 - i * 0.004;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(0, 212, 170, ${alpha})`;
  ctx.lineWidth = 3;
  ctx.stroke();
}

// Main breathing circle - gradient
const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, outerRadius);
gradient.addColorStop(0, '#00d4aa');
gradient.addColorStop(0.3, '#00b896');
gradient.addColorStop(0.6, '#008a6d');
gradient.addColorStop(1, '#005a42');

ctx.beginPath();
ctx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
ctx.fillStyle = gradient;
ctx.fill();

// Inner subtle highlight
const innerGradient = ctx.createRadialGradient(centerX - outerRadius * 0.2, centerY - outerRadius * 0.2, 0, centerX - outerRadius * 0.2, centerY - outerRadius * 0.2, outerRadius * 0.6);
innerGradient.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
innerGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.05)');
innerGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

ctx.beginPath();
ctx.arc(centerX, centerY, outerRadius * 0.9, 0, Math.PI * 2);
ctx.fillStyle = innerGradient;
ctx.fill();

// Subtle ring on the edge
ctx.beginPath();
ctx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
ctx.strokeStyle = 'rgba(0, 212, 170, 0.5)';
ctx.lineWidth = 2;
ctx.stroke();

// Breath phase indicators (4 small dots representing inhale, hold, exhale, hold)
const phaseCount = 4;
for (let i = 0; i < phaseCount; i++) {
  const angle = (i / phaseCount) * Math.PI * 2 - Math.PI / 2;
  const r = outerRadius * 1.15;
  const x = centerX + Math.cos(angle) * r;
  const y = centerY + Math.sin(angle) * r;
  
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
  ctx.fillStyle = i === 0 ? 'rgba(0, 212, 170, 0.8)' : 'rgba(0, 212, 170, 0.3)';
  ctx.fill();
  
  // Connector lines between phases
  const nextAngle = ((i + 1) / phaseCount) * Math.PI * 2 - Math.PI / 2;
  const nextX = centerX + Math.cos(nextAngle) * r;
  const nextY = centerY + Math.sin(nextAngle) * r;
  
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(nextX, nextY);
  ctx.strokeStyle = 'rgba(0, 212, 170, 0.15)';
  ctx.lineWidth = 1;
  ctx.setLineDash([8, 8]);
  ctx.stroke();
  ctx.setLineDash([]);
}

// Subtle particles around the outer ring
for (let i = 0; i < 16; i++) {
  const angle = (i / 16) * Math.PI * 2;
  const r = outerRadius * 1.35 + Math.random() * 8;
  const x = centerX + Math.cos(angle) * r;
  const y = centerY + Math.sin(angle) * r;
  const particleSize = Math.random() * 2.5 + 1;
  
  ctx.beginPath();
  ctx.arc(x, y, particleSize, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(0, 212, 170, ${0.2 + Math.random() * 0.3})`;
  ctx.fill();
}

// Save PNG
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync('/home/ubuntu/ataraxia/ataraxia-react/public/logo.png', buffer);
console.log('Logo created: /home/ubuntu/ataraxia/ataraxia-react/public/logo.png');