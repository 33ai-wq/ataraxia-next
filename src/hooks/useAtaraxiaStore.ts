import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface AtaraxiaState {
  xp: number
  breaths: number
  totalSeconds: number
  zenGrains: number
  maxSimultaneousSounds: number
  streakDays: number
  lastVisit: string
  intentions: string[]
  achievements: Record<string, boolean>
  profile: {
    name: string
    avatar: string | null
  }
}

const initialState: AtaraxiaState = {
  xp: 0,
  breaths: 0,
  totalSeconds: 0,
  zenGrains: 0,
  maxSimultaneousSounds: 1,
  streakDays: 0,
  lastVisit: '',
  intentions: [],
  achievements: {},
  profile: {
    name: '',
    avatar: null,
  },
}

const LEVELS = [
  { name: 'Seed', minXP: 0, emoji: '🌱' },
  { name: 'Sprout', minXP: 100, emoji: '🌿' },
  { name: 'Still Grove', minXP: 250, emoji: '🌳' },
  { name: 'Mirror Lake', minXP: 500, emoji: '🏞️' },
  { name: 'Silent Mountain', minXP: 1000, emoji: '⛰️' },
  { name: 'Boundless Ocean', minXP: 2000, emoji: '🌊' },
]

const ACHIEVEMENTS = [
  { id: 'first-breath', name: 'First Breath', condition: (s: AtaraxiaState) => s.breaths >= 1 },
  { id: 'steady-rhythm', name: 'Steady Rhythm', condition: (s: AtaraxiaState) => s.breaths >= 10 },
  { id: 'deep-diver', name: 'Deep Diver', condition: (s: AtaraxiaState) => s.breaths >= 50 },
  { id: 'still-water', name: 'Still Water', condition: (s: AtaraxiaState) => s.totalSeconds >= 300 },
  { id: 'zen-artist', name: 'Zen Artist', condition: (s: AtaraxiaState) => s.zenGrains >= 1000 },
  { id: 'sound-weaver', name: 'Sound Weaver', condition: (s: AtaraxiaState) => s.maxSimultaneousSounds >= 2 },
  { id: 'returning-soul', name: 'Returning Soul', condition: (s: AtaraxiaState) => s.streakDays >= 2 },
  { id: 'set-sail', name: 'Set Sail', condition: (s: AtaraxiaState) => s.intentions.length > 0 },
]

export { LEVELS, ACHIEVEMENTS }

export function levelFor(xp: number) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].minXP) return LEVELS[i]
  }
  return LEVELS[0]
}

export function checkAchievements(state: AtaraxiaState) {
  const newAchievements = { ...state.achievements }
  let hasNew = false
  
  for (const achievement of ACHIEVEMENTS) {
    if (!newAchievements[achievement.id] && achievement.condition(state)) {
      newAchievements[achievement.id] = true
      hasNew = true
    }
  }
  
  return { achievements: newAchievements, hasNew }
}

export const useAtaraxiaStore = create<AtaraxiaState & {
  addBreath: () => void
  addSandGrains: (count: number) => void
  addSeconds: (seconds: number) => void
  addIntention: (intention: string) => void
  updateProfile: (profile: Partial<AtaraxiaState['profile']>) => void
  incrementSounds: () => void
  updateStreak: () => void
  loadState: () => void
  saveState: () => void
  resetState: () => void
}>()(
  persist(
    (set, get) => ({
      ...initialState,
      
      addBreath: () => {
        const newBreaths = get().breaths + 1
        const newXP = get().xp + 10
        const { achievements, hasNew } = checkAchievements({ ...get(), breaths: newBreaths, xp: newXP })
        set({ 
          breaths: newBreaths, 
          xp: newXP,
          achievements,
        })
        if (hasNew) {
          // Toast notification handled by component
        }
      },
      
      addSandGrains: (count: number) => {
        const newGrains = get().zenGrains + count
        const newXP = get().xp + Math.floor(count / 50) * 2
        const { achievements, hasNew } = checkAchievements({ ...get(), zenGrains: newGrains, xp: newXP })
        set({ 
          zenGrains: newGrains, 
          xp: newXP,
          achievements,
        })
      },
      
      addSeconds: (seconds: number) => {
        const newTotal = get().totalSeconds + seconds
        set({ totalSeconds: newTotal })
      },
      
      addIntention: (intention: string) => {
        const newIntentions = [...get().intentions, intention]
        const { achievements, hasNew } = checkAchievements({ ...get(), intentions: newIntentions })
        set({ 
          intentions: newIntentions,
          achievements,
        })
      },
      
      updateProfile: (profile) => {
        set({ profile: { ...get().profile, ...profile } })
      },
      
      incrementSounds: () => {
        const newMax = Math.max(get().maxSimultaneousSounds, get().maxSimultaneousSounds + 1)
        const { achievements, hasNew } = checkAchievements({ ...get(), maxSimultaneousSounds: newMax })
        set({ 
          maxSimultaneousSounds: newMax,
          achievements,
        })
      },
      
      updateStreak: () => {
        const today = new Date().toDateString()
        const lastVisit = get().lastVisit
        let newStreak = get().streakDays
        
        if (lastVisit !== today) {
          const yesterday = new Date(Date.now() - 86400000).toDateString()
          if (lastVisit === yesterday) {
            newStreak += 1
          } else if (lastVisit !== '') {
            newStreak = 1
          }
        }
        
        const { achievements, hasNew } = checkAchievements({ ...get(), streakDays: newStreak, lastVisit: today })
        set({ 
          streakDays: newStreak,
          lastVisit: today,
          achievements,
        })
      },
      
      loadState: () => {
        // Zustand persist handles this automatically
        get().updateStreak()
      },
      
      saveState: () => {
        // Zustand persist handles this automatically
      },
      
      resetState: () => {
        set(initialState)
      },
    }),
    {
      name: 'ataraxia-stillness-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        xp: state.xp,
        breaths: state.breaths,
        totalSeconds: state.totalSeconds,
        zenGrains: state.zenGrains,
        maxSimultaneousSounds: state.maxSimultaneousSounds,
        streakDays: state.streakDays,
        lastVisit: state.lastVisit,
        intentions: state.intentions,
        achievements: state.achievements,
        profile: state.profile,
      }),
    }
  )
)