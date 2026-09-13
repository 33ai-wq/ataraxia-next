'use client'

import { useAtaraxiaStore, levelFor, LEVELS } from '@/hooks/useAtaraxiaStore'

export function Levels() {
  const { xp } = useAtaraxiaStore()
  const currentLevel = levelFor(xp)
  const currentLevelIndex = LEVELS.findIndex(l => l.name === currentLevel.name)

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h2 className="text-2xl font-light text-sand-900 mb-6">Levels</h2>

      <div className="space-y-4">
        {LEVELS.map((level, index) => {
          const isCurrent = index === currentLevelIndex
          const isUnlocked = index <= currentLevelIndex
          const progress = isCurrent && index < LEVELS.length - 1
            ? ((xp - level.minXP) / (LEVELS[index + 1].minXP - level.minXP)) * 100
            : isUnlocked && index < LEVELS.length - 1
              ? 100
              : 0

          return (
            <div
              key={level.name}
              className={`card p-4 relative overflow-hidden transition-all duration-300 ${
                isCurrent ? 'border-2 border-primary-300 bg-primary-50' : 'border-sand-200'
              }`}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl ${
                    isUnlocked
                      ? 'bg-primary-100'
                      : 'bg-sand-100'
                  }`}
                >
                  {level.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className={`font-medium ${isUnlocked ? 'text-sand-900' : 'text-sand-400'}`}>
                      {level.name}
                    </h3>
                    <span className={`text-sm font-mono ${isUnlocked ? 'text-primary-600' : 'text-sand-300'}`}>
                      {level.minXP.toLocaleString()} XP
                    </span>
                  </div>
                  {isCurrent && index < LEVELS.length - 1 && (
                    <div className="mt-2 h-2 bg-sand-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-500 rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  )}
                  {isUnlocked && index === LEVELS.length - 1 && (
                    <p className="mt-2 text-sm text-primary-600">🎉 Level maksimal tercapai!</p>
                  )}
                  {!isUnlocked && (
                    <p className="mt-2 text-sm text-sand-400">
                      Butuh {level.minXP - xp} XP lagi
                    </p>
                  )}
                </div>
                {isCurrent && (
                  <span className="px-2 py-1 text-xs bg-primary-100 text-primary-700 rounded-full font-medium">
                    AKTIF
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Level description */}
      <div className="mt-8 card p-6 bg-sand-50 border-sand-200">
        <h3 className="font-medium text-sand-900 mb-3">Tentang Level</h3>
        <div className="prose prose-sand max-w-none text-sm">
          <p className="mb-2">Setiap level mewakili kedalaman kedamaian yang semakin dalam:</p>
          <ul className="list-disc list-inside space-y-1 text-sand-600">
            <li><strong>🌱 Seed</strong> — Benih ketenangan baru ditanam</li>
            <li><strong>🌿 Sprout</strong> — Tunas tumbuh, kebiasaan terbentuk</li>
            <li><strong>🌳 Still Grove</strong> — Hutan sunyi, pikiran tenang</li>
            <li><strong>🏞️ Mirror Lake</strong> — Danau cermin, refleksi jernih</li>
            <li><strong>⛰️ Silent Mountain</strong> — Gunung diam, kestabilan mendalam</li>
            <li><strong>🌊 Boundless Ocean</strong> — Laut tanpa batas, kebebasan total</li>
          </ul>
          <p className="mt-3 text-sand-500">XP didapat dari: Breathing (10/siklus), Zen Garden (2 per 50 butir), streak harian, dan intentions.</p>
        </div>
      </div>
    </div>
  )
}