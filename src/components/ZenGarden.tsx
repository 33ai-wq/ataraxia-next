'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useAtaraxiaStore } from '@/hooks/useAtaraxiaStore'

interface Grain {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  life: number
  maxLife: number
}

export function ZenGarden() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)
  const grainsRef = useRef<Grain[]>([])
  const [zenGrains, setZenGrains] = useState(0)
  const [isDrawing, setIsDrawing] = useState(false)
  const { zenGrains: storedGrains, addSandGrains, addSeconds } = useAtaraxiaStore()

  useEffect(() => {
    setZenGrains(storedGrains)
  }, [storedGrains])

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect()
      if (rect) {
        canvas.width = rect.width * window.devicePixelRatio
        canvas.height = Math.min(300, rect.width * 0.75) * window.devicePixelRatio
        canvas.style.width = `${rect.width}px`
        canvas.style.height = `${Math.min(300, rect.width * 0.75)}px`
      }
    }

    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  useEffect(() => {
    initCanvas()
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')!
    let lastTime = 0
    let secondAccumulator = 0

    const colors = [
      '#e7e5e4', '#d6d3d1', '#a8a29e', '#78716c',
      '#f5f5f4', '#e7e5e4', '#d6d3d1'
    ]

    const spawnGrain = (x: number, y: number) => {
      const count = 3 + Math.floor(Math.random() * 3)
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5
        const speed = 0.5 + Math.random() * 1.5
        grainsRef.current.push({
          x: x + (Math.random() - 0.5) * 20,
          y: y + (Math.random() - 0.5) * 20,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 2 + Math.random() * 3,
          color: colors[Math.floor(Math.random() * colors.length)],
          life: 0,
          maxLife: 200 + Math.random() * 300,
        })
      }
    }

    const animate = (time: number) => {
      const dt = time - lastTime
      lastTime = time
      secondAccumulator += dt

      if (secondAccumulator >= 10000) {
        addSeconds(10)
        secondAccumulator = 0
      }

      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')!
      const width = canvas.width
      const height = canvas.height

      ctx.clearRect(0, 0, width, height)

      // Draw sand pile base
      const pileHeight = Math.min(100, zenGrains / 50)
      const pileCenterX = width / 2
      const pileBottomY = height - 20

      ctx.fillStyle = '#e7e5e4'
      ctx.beginPath()
      ctx.moveTo(pileCenterX - pileHeight * 1.5, pileBottomY)
      ctx.lineTo(pileCenterX, pileBottomY - pileHeight)
      ctx.lineTo(pileCenterX + pileHeight * 1.5, pileBottomY)
      ctx.closePath()
      ctx.fill()

      // Update and draw grains
      const newGrains: Grain[] = []
      for (const grain of grainsRef.current) {
        grain.x += grain.vx * dt * 0.03
        grain.y += grain.vy * dt * 0.03
        grain.vy += 0.0005 * dt // gravity
        grain.vx *= 0.995 // friction
        grain.life += dt

        // Check collision with sand pile
        const relX = grain.x - pileCenterX
        const relY = pileBottomY - grain.y
        const pileSlope = pileHeight / (pileHeight * 1.5)
        
        if (relY > 0 && relY < pileHeight && Math.abs(relX) < (pileHeight - relY) / pileSlope * 1.5) {
          // Grain landed in pile
          grain.vx = 0
          grain.vy = 0
          grain.y = pileBottomY - relY
        }

        if (grain.life < grain.maxLife && grain.y < height - 10) {
          const alpha = 1 - grain.life / grain.maxLife
          ctx.globalAlpha = alpha * 0.8
          ctx.fillStyle = grain.color
          ctx.beginPath()
          ctx.arc(grain.x, grain.y, grain.size * Math.max(0.3, alpha), 0, Math.PI * 2)
          ctx.fill()
          ctx.globalAlpha = 1
          newGrains.push(grain)
        } else if (grain.y >= height - 10 && grain.life < grain.maxLife) {
          // Settled at bottom
          grain.vx = 0
          grain.vy = 0
          const alpha = 1 - grain.life / grain.maxLife
          ctx.globalAlpha = alpha * 0.6
          ctx.fillStyle = grain.color
          ctx.beginPath()
          ctx.arc(grain.x, grain.y, grain.size * Math.max(0.3, alpha), 0, Math.PI * 2)
          ctx.fill()
          ctx.globalAlpha = 1
          newGrains.push(grain)
        }
      }

      grainsRef.current = newGrains
      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [initCanvas, zenGrains, addSeconds])

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true)
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) * window.devicePixelRatio
    const y = (e.clientY - rect.top) * window.devicePixelRatio
    
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')!
      // Spawn grains at click position
      for (let i = 0; i < 8; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = 1 + Math.random() * 2
        grainsRef.current.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 2 + Math.random() * 3,
          color: ['#e7e5e4', '#d6d3d1', '#a8a29e', '#78716c'][Math.floor(Math.random() * 4)],
          life: 0,
          maxLife: 200 + Math.random() * 300,
        })
      }
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) * window.devicePixelRatio
    const y = (e.clientY - rect.top) * window.devicePixelRatio
    
    // Spawn fewer grains on move
    if (Math.random() < 0.5) {
      const angle = Math.random() * Math.PI * 2
      const speed = 0.5 + Math.random() * 1.5
      grainsRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 1.5 + Math.random() * 2,
        color: ['#e7e5e4', '#d6d3d1', '#a8a29e', '#78716c'][Math.floor(Math.random() * 4)],
        life: 0,
        maxLife: 150 + Math.random() * 200,
      })
    }
  }

  const handleMouseUp = () => {
    setIsDrawing(false)
    // Award grains for drawing session
    const gained = 5 + Math.floor(Math.random() * 10)
    addSandGrains(gained)
    setZenGrains(prev => prev + gained)
  }

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const touch = e.touches[0]
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (touch.clientX - rect.left) * window.devicePixelRatio
    const y = (touch.clientY - rect.top) * window.devicePixelRatio
    setIsDrawing(true)
    // Spawn grains
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 1 + Math.random() * 2
      grainsRef.current.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 3,
        color: ['#e7e5e4', '#d6d3d1', '#a8a29e', '#78716c'][Math.floor(Math.random() * 4)],
        life: 0,
        maxLife: 200 + Math.random() * 300,
      })
    }
  }

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    if (!isDrawing) return
    const touch = e.touches[0]
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (touch.clientX - rect.left) * window.devicePixelRatio
    const y = (touch.clientY - rect.top) * window.devicePixelRatio
    
    if (Math.random() < 0.5) {
      const angle = Math.random() * Math.PI * 2
      const speed = 0.5 + Math.random() * 1.5
      grainsRef.current.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 1.5 + Math.random() * 2,
        color: ['#e7e5e4', '#d6d3d1', '#a8a29e', '#78716c'][Math.floor(Math.random() * 4)],
        life: 0,
        maxLife: 150 + Math.random() * 200,
      })
    }
  }

  const handleTouchEnd = () => {
    setIsDrawing(false)
    const gained = 5 + Math.floor(Math.random() * 10)
    addSandGrains(gained)
    setZenGrains(prev => prev + gained)
  }

  const clearGarden = () => {
    grainsRef.current = []
    addSandGrains(50) // bonus for clearing
    setZenGrains(prev => prev + 50)
  }

  return (
    <div className="card p-6 flex flex-col items-center">
      <div className="w-full mb-4">
        <h3 className="text-lg font-medium text-sand-900 mb-2 flex items-center gap-2">
          <span className="text-xl">🏜️</span> Zen Garden
        </h3>
        <p className="text-sm text-sand-500">
          Sentuh/klik untuk menuangkan pasir. Pasir yang menumpuk = XP.
        </p>
      </div>

      <div className="relative w-full max-w-md" onMouseLeave={handleMouseUp}>
        <canvas
          ref={canvasRef}
          className="w-full h-64 bg-sand-50 rounded-xl border border-sand-200 touch-none"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          aria-label="Zen garden canvas - tap to pour sand"
        />
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 text-xs text-sand-500">
          <kbd className="px-2 py-1 bg-white/80 rounded border border-sand-200">Klik/tarik</kbd>
          <kbd className="px-2 py-1 bg-white/80 rounded border border-sand-200">Lepaskan</kbd>
        </div>
      </div>

      <div className="mt-4 w-full max-w-md flex flex-col gap-2 items-center">
        <div className="w-full h-3 bg-sand-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-500 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(zenGrains / 1000, 1) * 100}%` }}
          />
        </div>
        <p className="text-sm text-sand-600">
          Pasir terkumpul: <span className="font-medium text-sand-900">{zenGrains.toLocaleString()}</span> butir
        </p>
        <button
          onClick={clearGarden}
          className="btn-secondary text-sm w-full max-w-xs"
        >
          Kosongkan Taman (+50 butir)
        </button>
      </div>
    </div>
  )
}