'use client'

import { useEffect } from 'react'
import { useTimerStore } from '@/store/timerStore'

export function TimerEngine() {
  const { _setWorker } = useTimerStore()

  useEffect(() => {
    const worker = new Worker('/timer.worker.js')

    worker.onmessage = (e) => {
      const { type, remaining, phase } = e.data
      const store = useTimerStore.getState()

      if (type === 'TICK') {
        useTimerStore.setState({ remaining, phase })
      } else if (type === 'DONE') {
        if (phase === 'work') {
          store.incrementSetCount()
          const { setCount: newSetCount, totalSets, restSec } = useTimerStore.getState()

          if (totalSets > 0 && newSetCount >= totalSets) {
            playBeep(880, 0.3)
            useTimerStore.setState({ phase: 'idle', state: 'stopped' })
          } else {
            // 휴식 시작 - 빠르게 두 번
            playBeep(660, 0.12)
            setTimeout(() => playBeep(660, 0.12), 200)
            worker.postMessage({ type: 'START', payload: { seconds: restSec, phase: 'rest' } })
            useTimerStore.setState({ phase: 'rest', state: 'running', remaining: restSec })
          }
        } else if (phase === 'rest') {
          // 수행 시작 - 한 번
          playBeep(880, 0.2)
          worker.postMessage({ type: 'START', payload: { seconds: store.workSec, phase: 'work' } })
          useTimerStore.setState({ phase: 'work', state: 'running', remaining: store.workSec })
        }
      } else if (type === 'PAUSED') {
        useTimerStore.setState({ remaining })
      }
    }

    _setWorker(worker)

    return () => { worker.terminate() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}

export function playBeep(frequency: number, duration: number) {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = frequency
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + duration)
  } catch { /* 미지원 환경 무시 */ }
}
