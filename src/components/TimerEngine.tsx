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
        playBeep(phase === 'work' ? 880 : 440, 0.4)

        if (phase === 'work') {
          // 운동 종료 → 세트 카운트 증가 + 휴식 자동 시작
          store.incrementSetCount()
          worker.postMessage({ type: 'START', payload: { seconds: store.restSec, phase: 'rest' } })
          useTimerStore.setState({ phase: 'rest', state: 'running', remaining: store.restSec })
        } else if (phase === 'rest') {
          // 휴식 종료 → 운동 자동 시작
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

function playBeep(frequency: number, duration: number) {
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
