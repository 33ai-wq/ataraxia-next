'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function Header() {
  return (
    <header className="bg-white/80 backdrop-blur-sm border-b border-sand-200 sticky top-0 z-40">
      <div className="max-w-4xl mx-auto px-4 py-3">
        <Link href="/" className="flex items-center gap-2" aria-label="Ataraxia Home">
          <div className="w-8 h-8 bg-primary-100 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <span className="text-xl font-light text-sand-900 tracking-tight">Ataraxia</span>
        </Link>
        <p className="text-xs text-sand-500 mt-1 ml-10 max-w-xs hidden sm:block">
          A quiet, private sanctuary. Breathe. Listen. Play with the sand.
        </p>
      </div>
    </header>
  )
}