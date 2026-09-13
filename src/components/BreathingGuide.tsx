'use client'

import { useState, useEffect, useRef } from 'react'
import { useAtaraxiaStore } from '@/hooks/useAtaraxiaStore'

export function BreathingGuide() {
  const [phase, setPhase] = useState<'inhale' | 'hold' | 'exhale' | 'rest'>('inhale')
  const [progress, setProgress] = useState(0)
  const [cycleCount, setCycleCount] = useState(0)
  const { breaths, addBreath } = useAtaraxiaStore()
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const isActiveRef = useRef(false)

  const phases = [
    { name: 'inhale', label: 'Taruh', duration: 4000, color: 'primary-400' },
    { name: 'hold', label: 'Tahan', duration: 4000, color: 'primary-300' },
    { name: 'exhale', label: 'Hembuskan', duration: 6000, color: 'primary-200' },
    { name: 'rest', label: 'Istirahat', duration: 2000, color: 'sand-200' },
  ]

  const totalDuration = phases.reduce((sum, p) => sum + p.duration, 0)

  useEffect(() => {
    if (!isActiveRef.current) return

    const startPhase = (phaseName: typeof phase) => {
      setPhase(phaseName)
      setProgress(0)
      const phaseConfig = phases.find(p => p.name === phaseName)!
      let elapsed = 0
      const tick = 50

      intervalRef.current = setInterval(() => {
        elapsed += tick
        setProgress(Math.min(elapsed / phaseConfig.duration, 1))
        if (elapsed >= phaseConfig.duration) {
          clearInterval(intervalRef.current!)
          const currentIndex = phases.findIndex(p => p.name === phaseName)
          const nextIndex = (currentIndex + 1) % phases.length
          if (phases[nextIndex].name === 'inhale') {
            addBreath()
            setCycleCount(c => c + 1)
          }
          startPhase(phases[nextIndex].name as typeof phase)
        }
      }, tick)
    }

    startPhase('inhale')

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isActiveRef.current, addBreath])

  const toggle = () => {
    isActiveRef.current = !isActiveRef.current
    if (!isActiveRef.current && intervalRef.current) {
      clearInterval(intervalRef.current)
    }
  }

  const currentPhaseConfig = phases.find(p => p.name === phase)!

  return (
    <div className="card p-6 flex flex-col items-center">
      <div className="w-40 h-40 md:w-48 md:h-48 relative mb-6">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
          <circle
            cx="60"
            cy="60"
            r="50"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-sand-100"
          />
          <circle
            cx="60"
            cy="60"
            r="50"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeDasharray={`${2 * Math.PI * 50}`}
            strokeDashoffset={`${2 * Math.PI * 50 * (1 - progress)}`}
            strokeLinecap="round"
            className={`text-${currentPhaseConfig.color} transition-all duration-50`}
            style={{ transformOrigin: 'center' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl md:text-3xl font-light text-sand-700 animate-pulse">
            {currentPhaseConfig.label}
          </span>
        </div>
      </div>

      <div className="w-full max-w-xs mx-auto mb-4">
        <div className="h-2 bg-sand-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-50 ${
              phase === 'inhale' ? 'bg-primary-400' :
              phase === 'hold' ? 'bg-primary-300' :
              phase === 'exhale' ? 'bg-primary-200' : 'bg-sand-300'
            }`}
            style={{ width: `${(phases.findIndex(p => p.name === phase) + progress) / phases.length * 100}%` }}
          />
        </div>
      </div>

      <button
        onClick={toggle}
        className={`w-full max-w-xs px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
          isActiveRef.current
            ? 'bg-sand-200 text-sand-700 hover:bg-sand-300'
            : 'bg-primary-600 text-white hover:bg-primary-700'
        }`}
        aria-label={isActiveRef.current ? 'Hentikan breathing' : 'Mulai breathing'}
      >
        {isActiveRef.current ? 'Berhenti' : 'Mulai Breathing'}
      </button>

      <div className="mt-4 text-center">
        <p className="text-sm text-sand-500">
          Siklus selesai: <span className="font-medium text-sand-900">{cycleCount + breaths}</span>
        </p>
      </div>
    </div>
  )
}