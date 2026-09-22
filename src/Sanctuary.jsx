import { useEffect, useRef, useState, useCallback } from 'react';

const PATTERNS = {
  box: { name: 'Box', phases: [4000, 4000, 6000, 2000], labels: ['Inhale', 'Hold', 'Exhale', 'Hold'] },
  '4-7-8': { name: '4-7-8', phases: [4000, 7000, 8000, 1000], labels: ['Inhale', 'Hold', 'Exhale', 'Hold'] },
  coherent: { name: 'Coherent', phases: [5500, 0, 5500, 0], labels: ['Inhale', '', 'Exhale', ''] },
};

function Sanctuary({ wallet }) {
  const [breathPattern, setBreathPattern] = useState('box');
  const [breathPhase, setBreathPhase] = useState(0);
  const [activeLabel, setActiveLabel] = useState('Inhale');
  const [isBreathing, setIsBreathing] = useState(true);

  const breathingCoreRef = useRef(null);
  const breathTimeoutRef = useRef(null);
  const phaseIdxRef = useRef(0);
  const breathPatternRef = useRef(breathPattern);

  breathPatternRef.current = breathPattern;

  // Phase colors for visual feedback
  const phaseColors = {
    Inhale: '#00d4aa',
    Hold: '#00b896',
    Exhale: '#008a6d',
  };

  const updateLabels = useCallback((phaseName) => {
    setActiveLabel(phaseName);
  }, []);

  // Breathing cycle driver
  const runBreathCycle = useCallback(() => {
    if (breathTimeoutRef.current) clearTimeout(breathTimeoutRef.current);
    
    const step = () => {
      const pattern = PATTERNS[breathPatternRef.current];
      const phases = pattern.phases;
      const labels = pattern.labels;
      
      let idx = phaseIdxRef.current;
      if (idx >= phases.length) {
        idx = 0;
        phaseIdxRef.current = 0;
      }
      
      const dur = phases[idx];
      const phaseName = labels[idx];
      
      if (dur === 0) {
        phaseIdxRef.current = idx + 1;
        setBreathPhase(idx + 1);
        step();
        return;
      }
      
      updateLabels(phaseName);
      
      // Scale: inhale/hold = expand, exhale/hold = shrink
      const scale = ['Inhale', 'Hold'].includes(phaseName) ? 1.4 : 0.75;
      if (breathingCoreRef.current) {
        breathingCoreRef.current.style.transform = `translate(-50%, -50%) scale(${scale})`;
        // Update box-shadow color based on phase
        const color = phaseColors[phaseName] || '#00d4aa';
        breathingCoreRef.current.style.boxShadow = `
          0 0 60px ${color}99,
          0 0 120px ${color}66,
          inset 0 -15px 40px ${color}44
        `;
      }
      
      setBreathPhase(idx);
      phaseIdxRef.current = idx + 1;
      breathTimeoutRef.current = setTimeout(step, dur);
    };
    
    step();
  }, [updateLabels]);

  // Start/restart breathing
  useEffect(() => {
    phaseIdxRef.current = 0;
    runBreathCycle();
    return () => {
      if (breathTimeoutRef.current) clearTimeout(breathTimeoutRef.current);
    };
  }, [runBreathCycle]);

  // Restart when pattern changes
  const handlePatternChange = (pattern) => {
    breathPatternRef.current = pattern;
    phaseIdxRef.current = 0;
    setBreathPattern(pattern);
    setBreathPhase(0);
    runBreathCycle();
  };

  const restartBreath = () => {
    phaseIdxRef.current = 0;
    setBreathPhase(0);
    runBreathCycle();
  };

  const toggleBreathing = () => {
    setIsBreathing(!isBreathing);
    if (isBreathing) {
      if (breathTimeoutRef.current) clearTimeout(breathTimeoutRef.current);
    } else {
      runBreathCycle();
    }
  };

  const formatAddress = (addr) => {
    if (!addr) return '';
    return addr.slice(0, 6) + '...' + addr.slice(-4);
  };

  const pattern = PATTERNS[breathPattern];

  return (
    <div className="flex flex-col min-h-screen">

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden">
        {/* Ambient glow background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/3 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
        </div>

        <div className="relative z-10 w-full max-w-4xl mx-auto flex flex-col items-center gap-8">
          
          {/* Pattern Selector */}
          <div className="w-full flex flex-wrap justify-center gap-2 mb-2">
            {Object.entries(PATTERNS).map(([key, p]) => (
              <button
                key={key}
                onClick={() => handlePatternChange(key)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all border ${
                  breathPattern === key
                    ? 'bg-accent-dim border-accent text-accent shadow-[0_0_20px_var(--color-accent-glow)]'
                    : 'bg-bg border-border text-fg-muted hover:border-accent/50 hover:bg-bg-elevated'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>

          {/* Breathing Circle Container */}
          <div className="relative w-full max-w-[400px] aspect-square flex items-center justify-center">
            {/* Outer reference ring */}
            <div className="absolute inset-0 border border-border/30 rounded-full" />
            
            {/* Phase labels around the circle */}
            <div className="absolute inset-0 -inset-8 pointer-events-none">
              {pattern.labels.map((label, i) => {
                if (!label) return null;
                const angle = (i / 4) * Math.PI * 2 - Math.PI / 2;
                const radius = 180;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;
                const isActive = i === breathPhase && label === activeLabel;
                return (
                  <div
                    key={i}
                    className="absolute transform -translate-x-1/2 -translate-y-1/2 text-xs font-heading uppercase tracking-wider transition-all duration-300"
                    style={{
                      left: '50%',
                      top: '50%',
                      transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
                      color: isActive ? '#00d4aa' : '#888899',
                      fontWeight: isActive ? '600' : '400',
                      opacity: isActive ? 1 : 0.5,
                    }}
                  >
                    {label}
                  </div>
                );
              })}
            </div>

            {/* Breathing Circle - animated core */}
            <div
              ref={breathingCoreRef}
              className="breathing-core absolute"
              style={{
                transform: 'translate(-50%, -50%) scale(1)',
                transition: 'transform 0.1s ease, box-shadow 0.3s ease',
              }}
              onClick={restartBreath}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); restartBreath(); }} }
              aria-label="Breathing circle - click to restart cycle"
            >
              {/* Center indicator */}
              <div className="flex flex-col items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-fg/30" />
                <span className="text-[10px] text-fg-muted/60 uppercase tracking-widest mt-2">Tap to restart</span>
              </div>
            </div>

            {/* Inner static ring for reference */}
            <div className="absolute inset-12 border border-border/20 rounded-full pointer-events-none" />
          </div>

          {/* Current phase display */}
          <div className="text-center">
            <div className="font-heading text-3xl md:text-4xl font-bold tracking-tight mb-2 bg-gradient-to-r from-fg via-accent to-fg bg-clip-text text-transparent">
              {activeLabel}
            </div>
            <div className="text-fg-muted text-sm font-mono">
              {breathPattern === 'coherent' 
                ? '5.5s in • 5.5s out' 
                : breathPattern === '4-7-8'
                  ? '4s in • 7s hold • 8s out'
                  : '4s in • 4s hold • 6s out • 2s hold'}
            </div>
          </div>

          {/* Control buttons */}
          <div className="flex flex-wrap justify-center gap-3 mt-4">
            <button
              onClick={toggleBreathing}
              className={`btn-primary px-6 py-3 flex items-center gap-2 ${isBreathing ? '' : 'bg-fg-muted/20 border border-border text-fg-muted hover:border-accent hover:text-accent'}`}
            >
              {isBreathing ? '⏸️ Pause' : '▶️ Resume'}
            </button>
            <button
              onClick={restartBreath}
              className="btn-secondary px-6 py-3 flex items-center gap-2"
            >
              🔄 Restart
            </button>
          </div>

          {/* Wallet info / Guide link */}
          <div className="text-center text-xs text-fg-muted/60 max-w-xs mx-auto mt-8">
            <p>Connected: <span className="font-mono">{wallet ? formatAddress(wallet.address) : 'Not connected'}</span></p>
            <p className="mt-2">Breathing is free. No tracking. All local.</p>
          </div>
        </div>
      </main>

    </div>
  );
}

export default Sanctuary;