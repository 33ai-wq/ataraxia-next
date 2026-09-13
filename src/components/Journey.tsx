'use client'

import { useAtaraxiaStore, levelFor, ACHIEVEMENTS } from '@/hooks/useAtaraxiaStore'

export function Journey({ className = '' }: { className?: string }) {
  const { xp, achievements, streakDays, totalSeconds, breaths, zenGrains } = useAtaraxiaStore()
  const currentLevel = levelFor(xp)

  const stats = [
    { label: 'XP', value: xp.toLocaleString(), color: 'primary' },
    { label: 'Level', value: `${currentLevel.emoji} ${currentLevel.name}`, color: 'primary' },
    { label: 'Streak', value: `${streakDays} hari`, color: 'orange' },
    { label: 'Breath', value: breaths.toLocaleString(), color: 'blue' },
    { label: 'Pasir', value: zenGrains.toLocaleString(), color: 'yellow' },
    { label: 'Waktu', value: `${Math.floor(totalSeconds / 60)}m ${totalSeconds % 60}s`, color: 'green' },
  ]

  return (
    <section className={`card p-6 ${className}`}>
      <h3 className="text-lg font-medium text-sand-900 mb-4 flex items-center gap-2">
        <span className="text-xl">🗺️</span> Journey
      </h3>

      {/* Current Level */}
      <div className="mb-6 p-4 bg-primary-50 rounded-xl border border-primary-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-primary-700 font-medium">Level Saat Ini</span>
          <span className="text-2xl">{currentLevel.emoji}</span>
        </div>
        <h4 className="text-xl font-light text-primary-900">{currentLevel.name}</h4>
        <div className="mt-3 h-2 bg-primary-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-500 rounded-full transition-all duration-500"
            style={{ width: `${((xp - currentLevel.minXP) / (getNextLevelXP(xp) - currentLevel.minXP)) * 100}%` }}
          />
        </div>
        <p className="text-xs text-primary-600 mt-1 text-right">
          {xp - currentLevel.minXP} / {getNextLevelXP(xp) - currentLevel.minXP} XP ke level berikutnya
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        {stats.map((stat, i) => (
          <div key={i} className="p-3 bg-sand-50 rounded-xl border border-sand-200 text-center">
            <p className={`text-2xl font-light text-${stat.color}-600`}>{stat.value}</p>
            <p className="text-xs text-sand-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Achievements */}
      <div>
        <h4 className="text-sm font-medium text-sand-700 mb-3">Achievements</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {ACHIEVEMENTS.map(achievement => {
            const unlocked = achievements[achievement.id]
            return (
              <div
                key={achievement.id}
                className={`p-3 rounded-xl text-center transition-all duration-300 ${
                  unlocked
                    ? 'bg-primary-50 border-2 border-primary-200'
                    : 'bg-sand-50 border border-sand-200 opacity-50'
                }`}
              >
                <div className="text-2xl mb-1">{unlocked ? '✨' : '🔒'}</div>
                <p className={`text-xs font-medium ${unlocked ? 'text-primary-700' : 'text-sand-400'}`}>
                  {achievement.name}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function getNextLevelXP(xp: number) {
  const levels = [100, 250, 500, 1000, 2000, Infinity]
  for (const levelXP of levels) {
    if (xp < levelXP) return levelXP
  }
  return 2000
}