/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0a0a0f',
        'bg-elevated': '#11111a',
        fg: '#f0f0f5',
        'fg-muted': '#888899',
        accent: '#00d4aa',
        'accent-dim': '#00d4aa33',
        'accent-glow': '#00d4aa66',
        card: '#16161f',
        border: '#2a2a3a',
        danger: '#ff4757',
        warning: '#ffa502',
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        heading: ['Space Grotesk', 'sans-serif'],
      },
      animation: {
        'breathe': 'breathe 8s ease-in-out infinite',
        'spin': 'spin 1s linear infinite',
        'slideUp': 'slideUp 0.3s ease',
      },
      keyframes: {
        breathe: {
          '0%, 100%': { transform: 'translate(-50%, -50%) scale(1)' },
          '25%': { transform: 'translate(-50%, -50%) scale(1.35)' },
          '50%': { transform: 'translate(-50%, -50%) scale(1)' },
          '75%': { transform: 'translate(-50%, -50%) scale(0.85)' },
        },
        spin: {
          to: { transform: 'rotate(360deg)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}