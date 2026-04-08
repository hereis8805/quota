'use client'

import { useEffect, useState } from 'react'
import { useTimerStore } from '@/store/timerStore'
import { TimerEngine } from '@/components/TimerEngine'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import type { WorkoutSettings } from '@/types'
import Link from 'next/link'

interface Props {
  settings: WorkoutSettings | null
  userId: string
}

function CircleTimer({
  remaining,
  total,
  phase,
  setNum,
}: {
  remaining: number
  total: number
  phase: string
  setNum: number
}) {
  const SIZE = 220
  const STROKE = 10
  const R = (SIZE - STROKE) / 2
  const circumference = 2 * Math.PI * R
  const progress = total > 0 ? Math.max(0, remaining / total) : 1
  const dashOffset = circumference * (1 - progress)

  const arcColor = phase === 'work' ? '#22c55e' : phase === 'rest' ? '#3b82f6' : '#52525b'
  const numColor = phase === 'work' ? '#22c55e' : phase === 'rest' ? '#60a5fa' : '#52525b'

  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60
  const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  return (
    <div className="relative flex items-center justify-center" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} style={{ transform: 'rotate(-90deg)', position: 'absolute' }}>
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="#27272a" strokeWidth={STROKE} />
        <circle
          cx={SIZE / 2} cy={SIZE / 2} r={R}
          fill="none" stroke={arcColor} strokeWidth={STROKE}
          strokeDasharray={circumference} strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 0.3s ease' }}
        />
      </svg>

      <div className="absolute flex flex-col items-center gap-0.5">
        {setNum > 0 ? (
          <span className="font-bold leading-none" style={{ fontSize: 52, color: numColor }}>
            {setNum}
          </span>
        ) : (
          <span className="text-zinc-600 text-2xl font-bold leading-none">—</span>
        )}
        <span className="text-2xl font-mono font-semibold text-white tracking-widest leading-none">
          {timeStr}
        </span>
      </div>
    </div>
  )
}

export default function TimerPageClient({ settings, userId }: Props) {
  const { phase, state, remaining, startWork, pauseResume, reset, init, workSec, restSec, setCount } =
    useTimerStore()

  const [localWork, setLocalWork] = useState(settings?.interval_work_sec ?? 30)
  const [localRest, setLocalRest] = useState(settings?.interval_rest_sec ?? 90)
  const [reps, setReps] = useState(10)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    init(localWork, localRest)
  }, []) // eslint-disable-line

  const getTotalSec = () => {
    if (phase === 'work') return workSec
    if (phase === 'rest') return restSec
    return workSec
  }

  // 원 안에 표시할 세트 번호
  // work 중: setCount + 1 (아직 완료 전)
  // rest 중: setCount (방금 완료한 세트)
  // idle: 0
  const displaySetNum = phase === 'work' ? setCount + 1 : phase === 'rest' ? setCount : 0

  const isRunning = state === 'running'
  const isIdle = phase === 'idle' && state === 'stopped'

  function handleMainBtn() {
    if (isIdle) startWork()
    else pauseResume()
  }

  function handleReset() {
    reset()
    init(localWork, localRest)
  }

  async function handleSaveSettings() {
    const supabase = createClient()
    if (settings?.id) {
      await supabase.from('workout_settings')
        .update({ interval_work_sec: localWork, interval_rest_sec: localRest })
        .eq('id', settings.id)
    } else {
      await supabase.from('workout_settings')
        .insert({ user_id: userId, interval_work_sec: localWork, interval_rest_sec: localRest })
    }
    init(localWork, localRest)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const mainBtnClass = isIdle
    ? 'bg-green-600 hover:bg-green-700'
    : isRunning
    ? 'bg-red-600 hover:bg-red-700'
    : 'bg-amber-500 hover:bg-amber-600'

  const mainBtnLabel = isIdle ? '시작' : isRunning ? '일시정지' : '재개'

  return (
    <div className="min-h-screen max-w-sm mx-auto p-4 flex flex-col gap-4">
      <TimerEngine />

      <div className="flex items-center justify-between">
        <Link href="/dashboard" className="text-zinc-400 hover:text-white text-sm">← 대시보드</Link>
        <h1 className="text-lg font-bold">인터벌 타이머</h1>
        <Button variant="ghost" size="sm" className="text-zinc-500 hover:text-white" onClick={handleReset}>
          초기화
        </Button>
      </div>

      {/* 원형 타이머 */}
      <div className="flex justify-center py-2">
        <CircleTimer remaining={remaining} total={getTotalSec()} phase={phase} setNum={displaySetNum} />
      </div>

      {/* 설정 섹션 */}
      <div className="bg-zinc-900 rounded-2xl p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-400 w-20">운동 시간</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="w-9 h-9 p-0" disabled={!isIdle}
              onClick={() => setLocalWork((v) => Math.max(5, v - 5))}>−</Button>
            <Input type="number" min={5} className="w-16 h-9 text-center font-bold"
              value={localWork} disabled={!isIdle}
              onChange={(e) => { const n = parseInt(e.target.value); if (!isNaN(n) && n >= 5) setLocalWork(n) }} />
            <span className="text-zinc-500 text-sm w-4">초</span>
            <Button variant="outline" className="w-9 h-9 p-0" disabled={!isIdle}
              onClick={() => setLocalWork((v) => v + 5)}>+</Button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-400 w-20">휴식 시간</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="w-9 h-9 p-0" disabled={!isIdle}
              onClick={() => setLocalRest((v) => Math.max(5, v - 5))}>−</Button>
            <Input type="number" min={5} className="w-16 h-9 text-center font-bold"
              value={localRest} disabled={!isIdle}
              onChange={(e) => { const n = parseInt(e.target.value); if (!isNaN(n) && n >= 5) setLocalRest(n) }} />
            <span className="text-zinc-500 text-sm w-4">초</span>
            <Button variant="outline" className="w-9 h-9 p-0" disabled={!isIdle}
              onClick={() => setLocalRest((v) => v + 5)}>+</Button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-400 w-20">횟수</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="w-9 h-9 p-0"
              onClick={() => setReps((v) => Math.max(1, v - 1))}>−</Button>
            <Input type="number" min={1} className="w-16 h-9 text-center font-bold text-lg"
              value={reps}
              onChange={(e) => { const n = parseInt(e.target.value); if (!isNaN(n) && n >= 1) setReps(n) }} />
            <span className="text-zinc-500 text-sm w-4">회</span>
            <Button variant="outline" className="w-9 h-9 p-0"
              onClick={() => setReps((v) => v + 1)}>+</Button>
          </div>
        </div>
      </div>

      {isIdle && (
        <Button variant="outline" className="w-full h-10 text-sm text-zinc-400" onClick={handleSaveSettings}>
          {saved ? '저장됨 ✓' : '타이머 설정 저장'}
        </Button>
      )}

      <Button size="lg" className={`w-full h-16 text-xl font-bold mt-auto ${mainBtnClass}`} onClick={handleMainBtn}>
        {mainBtnLabel}
      </Button>
    </div>
  )
}
