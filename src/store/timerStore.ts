'use client'

import { create } from 'zustand'
import type { TimerPhase, TimerState } from '@/types'

interface TimerStoreState {
  phase: TimerPhase
  state: TimerState
  remaining: number
  workSec: number
  restSec: number
  setCount: number
  worker: Worker | null

  init: (workSec: number, restSec: number) => void
  startWork: () => void
  pauseResume: () => void
  reset: () => void
  incrementSetCount: () => void
  _setWorker: (w: Worker) => void
}

export const useTimerStore = create<TimerStoreState>((set, get) => ({
  phase: 'idle',
  state: 'stopped',
  remaining: 30,
  workSec: 30,
  restSec: 90,
  setCount: 0,
  worker: null,

  _setWorker: (w) => set({ worker: w }),

  init(workSec, restSec) {
    const { worker } = get()
    if (worker) worker.postMessage({ type: 'STOP' })
    set({ workSec, restSec, phase: 'idle', state: 'stopped', remaining: workSec, setCount: 0 })
  },

  startWork() {
    const { worker, workSec } = get()
    if (!worker) return
    worker.postMessage({ type: 'START', payload: { seconds: workSec, phase: 'work' } })
    set({ phase: 'work', state: 'running', remaining: workSec })
  },

  pauseResume() {
    const { worker, state } = get()
    if (!worker) return
    if (state === 'running') {
      worker.postMessage({ type: 'PAUSE' })
      set({ state: 'paused' })
    } else if (state === 'paused') {
      worker.postMessage({ type: 'RESUME' })
      set({ state: 'running' })
    }
  },

  reset() {
    const { worker, workSec } = get()
    if (worker) worker.postMessage({ type: 'STOP' })
    set({ phase: 'idle', state: 'stopped', remaining: workSec, setCount: 0 })
  },

  incrementSetCount() {
    set((s) => ({ setCount: s.setCount + 1 }))
  },
}))
