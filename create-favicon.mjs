import { createCanvas } from 'canvas';
import fs from 'fs';

// Create favicon sizes
const sizes = [16, 32, 48, 64, 128, 256, 512];

for (const size of sizes) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // Dark background
  ctx.fillStyle = '#0a0a0f';
  ctx.fillRect(0, 0, size, size);
  
  const centerX = size / 2;
  const centerY = size / 2;
  const outerRadius = size * 0.4;
  
  // Main breathing circle - gradient
  const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, outerRadius);
  gradient.addColorStop(0, '#00d4aa');
  gradient.addColorStop(0.5, '#008a6d');
  gradient.addColorStop(1, '#004d3a');
  
  ctx.beginPath();
  ctx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();
  
  // Subtle highlight
  const innerGradient = ctx.createRadialGradient(centerX - outerRadius * 0.2, centerY - outerRadius * 0.2, 0, centerX - outerRadius * 0.2, centerY - outerRadius * 0.2, outerRadius * 0.6);
  innerGradient.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
  innerGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  
  ctx.beginPath();
  ctx.arc(centerX, centerY, outerRadius * 0.85, 0, Math.PI * 2);
  ctx.fillStyle = innerGradient;
  ctx.fill();
  
  // Edge ring
  ctx.beginPath();
  ctx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0, 212, 170, 0.6)';
  ctx.lineWidth = Math.max(1, size / 64);
  ctx.stroke();
  
  // Save
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(`/home/ubuntu/ataraxia/ataraxia-react/public/favicon-${size}.png`, buffer);
  console.log(`Favicon created: ${size}x${size}`);
}

// Also create a multi-size ICO by using the 256 as base
const icoCanvas = createCanvas(256, 256);
const icoCtx = icoCanvas.getContext('2d');
icoCtx.fillStyle = '#0a0a0f';
icoCtx.fillRect(0, 0, 256, 256);

const centerX = 128;
const centerY = 128;
const outerRadius = 102;

const gradient = icoCtx.createRadialGradient(centerX, centerY, 0, centerX, centerY, outerRadius);
gradient.addColorStop(0, '#00d4aa');
gradient.addColorStop(0.5, '#008a6d');
gradient.addColorStop(1, '#004d3a');

icoCtx.beginPath();
icoCtx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
icoCtx.fillStyle = gradient;
icoCtx.fill();

const innerGradient = icoCtx.createRadialGradient(centerX - outerRadius * 0.2, centerY - outerRadius * 0.2, 0, centerX - outerRadius * 0.2, centerY - outerRadius * 0.2, outerRadius * 0.6);
innerGradient.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
innerGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

icoCtx.beginPath();
icoCtx.arc(centerX, centerY, outerRadius * 0.85, 0, Math.PI * 2);
icoCtx.fillStyle = innerGradient;
icoCtx.fill();

icoCtx.beginPath();
icoCtx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
icoCtx.strokeStyle = 'rgba(0, 212, 170, 0.6)';
icoCtx.lineWidth = 2;
icoCtx.stroke();

const icoBuffer = icoCanvas.toBuffer('image/png');
fs.writeFileSync('/home/ubuntu/ataraxia/ataraxia-react/public/favicon.ico', icoBuffer);
console.log('Favicon ICO created');