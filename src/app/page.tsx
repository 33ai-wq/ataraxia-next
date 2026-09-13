'use client'

import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/Header'
import { Navigation } from '@/components/Navigation'
import { BreathingGuide } from '@/components/BreathingGuide'
import { AmbientSoundscape } from '@/components/AmbientSoundscape'
import { ZenGarden } from '@/components/ZenGarden'
import { Journey } from '@/components/Journey'
import { Profile } from '@/components/Profile'
import { Levels } from '@/components/Levels'
import { Guide } from '@/components/Guide'
import { useAtaraxiaStore } from '@/hooks/useAtaraxiaStore'

type Page = 'dashboard' | 'guide' | 'profile' | 'levels' | 'reward'

export default function Home() {
  const [activePage, setActivePage] = useState<Page>('dashboard')
  const [mounted, setMounted] = useState(false)
  const { loadState, saveState } = useAtaraxiaStore()

  useEffect(() => {
    setMounted(true)
    loadState()
  }, [loadState])

  useEffect(() => {
    if (mounted) {
      saveState()
    }
  }, [mounted, saveState])

  if (!mounted) {
    return (
      <div className="min-h-screen bg-sand-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-breathe-in w-20 h-20 mx-auto mb-4 bg-primary-100 rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <p className="text-sand-600">Memuat sanctuary...</p>
        </div>
      </div>
    )
  }

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return (
          <main className="max-w-4xl mx-auto px-4 py-8">
            <section className="mb-8">
              <h1 className="text-3xl md:text-4xl font-light text-sand-900 mb-2 text-balance">
                A quiet, private sanctuary.
              </h1>
              <p className="text-sand-600 text-lg">Breathe. Listen. Play with the sand.</p>
            </section>
            <div className="grid md:grid-cols-3 gap-6">
              <BreathingGuide />
              <AmbientSoundscape />
              <ZenGarden />
            </div>
            <Journey className="mt-12" />
          </main>
        )
      case 'guide':
        return <Guide />
      case 'profile':
        return <Profile />
      case 'levels':
        return <Levels />
      case 'reward':
        return <div className="max-w-2xl mx-auto px-4 py-8"><p className="text-sand-600 text-center">Reward page — coming soon</p></div>
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-sand-50 flex flex-col">
      <Header />
      <Navigation activePage={activePage} setActivePage={setActivePage} />
      <div className="flex-1">
        {renderPage()}
      </div>
    </div>
  )
}