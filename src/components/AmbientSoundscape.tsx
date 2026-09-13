'use client'

import { useState, useRef, useEffect } from 'react'
import { Howl, Howler } from 'howler'
import { useAtaraxiaStore } from '@/hooks/useAtaraxiaStore'

const SOUNDS = [
  { id: 'rain', name: 'Hujan', emoji: '🌧️', color: 'blue' },
  { id: 'forest', name: 'Hutan', emoji: '🌲', color: 'green' },
  { id: 'ocean', name: 'Laut', emoji: '🌊', color: 'cyan' },
  { id: 'fire', name: 'Api', emoji: '🔥', color: 'orange' },
  { id: 'wind', name: 'Angin', emoji: '💨', color: 'gray' },
  { id: 'birds', name: 'Burung', emoji: '🐦', color: 'yellow' },
]

export function AmbientSoundscape() {
  const [activeSounds, setActiveSounds] = useState<Set<string>>(new Set())
  const [volumes, setVolumes] = useState<Record<string, number>>({})
  const { maxSimultaneousSounds, incrementSounds } = useAtaraxiaStore()
  const howlsRef = useRef<Record<string, Howl>>({})

  useEffect(() => {
    SOUNDS.forEach(sound => {
      howlsRef.current[sound.id] = new Howl({
        src: [`/sounds/${sound.id}.mp3`],
        loop: true,
        volume: volumes[sound.id] ?? 0.5,
        onload: () => {},
        onloaderror: () => {
          console.warn(`Sound ${sound.id} not found, using silent placeholder`)
        },
      })
    })

    return () => {
      Object.values(howlsRef.current).forEach(h => h.unload())
    }
  }, [])

  const toggleSound = (soundId: string) => {
    const howl = howlsRef.current[soundId]
    if (!howl) return

    setActiveSounds(prev => {
      const next = new Set(prev)
      if (next.has(soundId)) {
        next.delete(soundId)
        howl.pause()
      } else {
        if (next.size >= maxSimultaneousSounds && maxSimultaneousSounds < SOUNDS.length) {
          incrementSounds()
        }
        next.add(soundId)
        howl.play()
      }
      return next
    })
  }

  const setVolume = (soundId: string, volume: number) => {
    const howl = howlsRef.current[soundId]
    if (howl) howl.volume(volume)
    setVolumes(prev => ({ ...prev, [soundId]: volume }))
  }

  return (
    <div className="card p-6">
      <h3 className="text-lg font-medium text-sand-900 mb-4 flex items-center gap-2">
        <span className="text-xl">🎵</span> Ambient Soundscape
      </h3>
      <p className="text-sm text-sand-500 mb-4">
        Klik untuk mainkan/hentikan. Geser untuk atur volume. Maksimal {maxSimultaneousSounds} suara bersamaan.
      </p>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {SOUNDS.map(sound => {
          const isActive = activeSounds.has(sound.id)
          const volume = volumes[sound.id] ?? 0.5
          const howl = howlsRef.current[sound.id]
          
          return (
            <div
              key={sound.id}
              className={`relative p-4 rounded-xl transition-all duration-300 ${
                isActive 
                  ? `bg-${sound.color}-50 border-2 border-${sound.color}-300` 
                  : 'bg-sand-50 border border-sand-200 hover:border-sand-300'
              }`}
            >
              <button
                onClick={() => toggleSound(sound.id)}
                className="w-full h-full flex flex-col items-center gap-3"
                aria-label={`${isActive ? 'Hentikan' : 'Mainkan'} ${sound.name}`}
                aria-pressed={isActive}
              >
                <span className="text-4xl animate-float">{sound.emoji}</span>
                <span className={`font-medium ${isActive ? `text-${sound.color}-700` : 'text-sand-700'}`}>
                  {sound.name}
                </span>
                <div className="w-full h-1.5 bg-sand-200 rounded-full overflow-hidden mt-2">
                  <div
                    className={`h-full rounded-full transition-all duration-100 ${
                      isActive ? `bg-${sound.color}-500` : 'bg-sand-300'
                    }`}
                    style={{ width: `${volume * 100}%` }}
                  />
                </div>
              </button>

              {isActive && (
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={volume}
                  onChange={e => setVolume(sound.id, parseFloat(e.target.value))}
                  className="absolute bottom-2 left-4 right-4 h-2 bg-transparent appearance-none cursor-pointer"
                  style={{
                    WebkitAppearance: 'none',
                  }}
                  aria-label={`Volume ${sound.name}`}
                />
              )}
            </div>
          )
        })}
      </div>

      {activeSounds.size > 0 && (
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => {
              activeSounds.forEach(id => howlsRef.current[id]?.pause())
              setActiveSounds(new Set())
            }}
            className="btn-secondary text-sm flex-1"
          >
            Hentikan Semua
          </button>
        </div>
      )}
    </div>
  )
}