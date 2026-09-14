export const LEVELS = [
  { xp: 0,    name: 'Seed of Calm',    icon: '🌱' },
  { xp: 100,  name: 'Sprout',          icon: '🌿' },
  { xp: 250,  name: 'Still Grove',     icon: '🌳' },
  { xp: 500,  name: 'Mirror Lake',     icon: '🏞️' },
  { xp: 1000, name: 'Silent Mountain', icon: '⛰️' },
  { xp: 2000, name: 'Boundless Ocean', icon: '🌊' },
];

export function levelFor(xp){ let l=0; LEVELS.forEach((v,i)=>{ if(xp>=v.xp) l=i; }); return l; }

export const ACHIEVEMENTS = [
  { id: 'first-breath', name: 'First Breath', icon: '🫁', desc: 'Complete 1 breath cycle', check: s => s.breaths >= 1 },
  { id: 'ten-breaths', name: 'Steady Rhythm', icon: '🔥', desc: 'Complete 10 breath cycles', check: s => s.breaths >= 10 },
  { id: 'fifty-breaths', name: 'Deep Diver', icon: '💎', desc: 'Complete 50 breath cycles', check: s => s.breaths >= 50 },
  { id: 'five-min', name: 'Still Water', icon: '⏳', desc: 'Rest 5 minutes in sanctuary', check: s => s.totalSeconds >= 300 },
  { id: 'zen-artist', name: 'Zen Artist', icon: '🎨', desc: 'Scatter 1,000 sand grains', check: s => s.zenGrains >= 1000 },
  { id: 'mixer', name: 'Sound Weaver', icon: '🎧', desc: 'Play 2 sounds together', check: s => s.maxSimultaneousSounds >= 2 },
  { id: 'returning', name: 'Returning Soul', icon: '🌅', desc: 'Visit 2 days in a row', check: s => s.streakDays >= 2 },
  { id: 'intention', name: 'Set Sail', icon: '🧭', desc: "Set today's intention", check: s => !!s.intentions?.[todayKey()] },
];

function todayKey(){ return new Date().toISOString().slice(0,10); }
export const ALL_ACHIEVEMENTS = ACHIEVEMENTS;
export const ACHIEVEMENTS_BY_LEVEL = [ACHIEVEMENTS];

export default function Levels({ still }) {
  const unlocked = new Set(still.achievements || []);
  const lvlIdx = levelFor(still.xp);
  const lvl = LEVELS[lvlIdx];
  const next = LEVELS[lvlIdx+1];
  const pct = next ? Math.min(100, Math.round(((still.xp - lvl.xp)/(next.xp - lvl.xp))*100)) : 100;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center py-2">
        <p className="text-3xl mb-2">🏆</p>
        <h2 className="font-heading text-3xl font-bold">Levels & Achievements</h2>
        <p className="text-fg-muted text-sm">6 levels · 8 core achievements · calm over grind</p>
      </div>

      <section className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">{lvl.icon}</span>
          <div className="flex-1">
            <div className="flex items-center justify-between text-sm mb-1"><span className="font-semibold">{lvl.name}</span><span className="text-fg-muted font-mono text-xs">{still.xp} XP{next ? ` → ${next.xp}` : ' · MAX'}</span></div>
            <div className="h-2 bg-bg rounded-full overflow-hidden border border-border/50"><div className="h-full bg-gradient-to-r from-accent to-[#008a6d] rounded-full transition-all" style={{ width: `${pct}%` }} /></div>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {LEVELS.map((l,i)=>(
            <div key={l.name} className={`flex-shrink-0 px-3 py-2 rounded-xl border text-center min-w-[110px] ${i===lvlIdx ? 'bg-accent-dim border-accent' : i < lvlIdx ? 'bg-card border-border' : 'bg-bg border-border/50 opacity-60'}`}>
              <div className="text-lg">{l.icon}</div><div className="text-xs font-semibold">{l.name}</div><div className="text-[11px] text-fg-muted">{l.xp} XP</div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading font-semibold">8 Core Achievements</h3>
          <span className="text-xs text-fg-muted">{ACHIEVEMENTS.filter(a=> unlocked.has(a.id) || a.check(still)).length} / 8 unlocked</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {ACHIEVEMENTS.map(a=>{
            const got = unlocked.has(a.id) || a.check(still);
            return (
              <div key={a.id} title={`${a.name} — ${a.desc}`} className={`p-4 rounded-xl border text-center flex flex-col items-center gap-1 ${got ? 'bg-accent-dim border-accent/40' : 'bg-bg border-border/50 opacity-50 grayscale'}`}>
                <span className="text-2xl">{a.icon}</span>
                <span className="text-xs font-semibold">{a.name}</span>
                <span className="text-[11px] text-fg-muted leading-tight">{a.desc}</span>
                {got ? <span className="text-[11px] text-accent font-bold">✓ Unlocked</span> : <span className="text-[11px] text-fg-muted">Locked</span>}
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-fg-muted mt-4">Unlock by breathing, listening, drawing and returning — no grind, just calm. Progress stored locally on your device.</p>
      </section>
    </div>
  );
}
