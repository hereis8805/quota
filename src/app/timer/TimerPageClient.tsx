'use client'

import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { useTimerStore } from '@/store/timerStore'
import { TimerEngine, playBeep } from '@/components/TimerEngine'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import type { TimerPreset } from '@/types'
import Link from 'next/link'

interface Props {
  userId: string
}

function CircleTimer({
  remaining,
  total,
  phase,
  isPaused,
  setNum,
}: {
  remaining: number
  total: number
  phase: string
  isPaused: boolean
  setNum: number
}) {
  const SIZE = 220
  const STROKE = 10
  const R = (SIZE - STROKE) / 2
  const circumference = 2 * Math.PI * R

  const arcRef = useRef<SVGCircleElement>(null)
  const rafRef = useRef<number | undefined>(undefined)
  const stateRef = useRef({ remaining, total, phase, tickTime: performance.now() })

  useEffect(() => {
    stateRef.current.tickTime = performance.now()
    stateRef.current.remaining = remaining
  }, [remaining])

  useEffect(() => {
    stateRef.current.total = total
    stateRef.current.phase = phase
  }, [total, phase])

  const shouldAnimate = phase !== 'idle' && !isPaused

  useEffect(() => {
    if (!shouldAnimate) {
      // 멈춤: 현재 위치 고정
      if (arcRef.current) {
        const r = stateRef.current.remaining
        const t = stateRef.current.total
        const p = stateRef.current.phase
        const progress = t > 0 ? r / t : 1
        arcRef.current.style.strokeDashoffset = String(
          p === 'rest' ? circumference * progress : circumference * (1 - progress)
        )
      }
      return
    }
    stateRef.current.tickTime = performance.now()
    function frame() {
      const { remaining: r, total: t, phase: p, tickTime } = stateRef.current
      const elapsed = (performance.now() - tickTime) / 1000
      const smooth = Math.max(0, r - elapsed)
      const progress = t > 0 ? smooth / t : 1
      const dashOffset = p === 'rest'
        ? circumference * progress
        : circumference * (1 - progress)
      if (arcRef.current) {
        arcRef.current.style.strokeDashoffset = String(dashOffset)
      }
      rafRef.current = requestAnimationFrame(frame)
    }
    rafRef.current = requestAnimationFrame(frame)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [shouldAnimate, circumference])

  const arcColor = phase === 'work' ? '#22c55e' : phase === 'rest' ? '#3b82f6' : '#52525b'
  const numColor = phase === 'work' ? '#22c55e' : phase === 'rest' ? '#60a5fa' : '#52525b'
  const phaseLabel = phase === 'work' ? '운동' : phase === 'rest' ? '휴식' : ''

  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60
  const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  return (
    <div className="relative flex items-center justify-center" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} style={{ transform: 'rotate(-90deg)', position: 'absolute' }}>
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="#27272a" strokeWidth={STROKE} />
        <circle
          ref={arcRef}
          cx={SIZE / 2} cy={SIZE / 2} r={R}
          fill="none" stroke={arcColor} strokeWidth={STROKE}
          strokeDasharray={circumference}
          strokeLinecap="round"
          style={{ transition: 'stroke 0.3s ease' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center gap-0.5">
        {phaseLabel ? (
          <span className="text-xs font-medium tracking-widest uppercase" style={{ color: numColor }}>{phaseLabel}</span>
        ) : (
          <span className="text-xs text-transparent select-none">—</span>
        )}
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

export default function TimerPageClient({ userId }: Props) {
  const { phase, state, remaining, startWork, pauseResume, reset, init, workSec, restSec, setCount } =
    useTimerStore()

  const { data: timerData } = useSWR(
    `timer-${userId}`,
    async () => {
      const supabase = createClient()
      const [settingsRes, presetsRes] = await Promise.all([
        supabase.from('workout_settings').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('timer_presets').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
      ])
      return {
        settings: settingsRes.data ?? null,
        presets: presetsRes.data ?? [],
      }
    },
    { revalidateOnFocus: false }
  )

  const [localWork, setLocalWork] = useState(30)
  const [localRest, setLocalRest] = useState(90)
  const [reps, setReps] = useState(10)
  const [presets, setPresets] = useState<TimerPreset[]>([])
  const initialized = useRef(false)

  useEffect(() => {
    if (timerData && !initialized.current) {
      const work = timerData.settings?.interval_work_sec ?? 30
      const rest = timerData.settings?.interval_rest_sec ?? 90
      setLocalWork(work)
      setLocalRest(rest)
      setPresets(timerData.presets)
      init(work, rest)
      initialized.current = true
    }
  }, [timerData]) // eslint-disable-line

  useEffect(() => {
    if (!timerData) init(localWork, localRest)
  }, []) // eslint-disable-line

  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null)

  const [showSaveForm, setShowSaveForm] = useState(false)
  const [saveNameInput, setSaveNameInput] = useState('')

  const [editingPresetId, setEditingPresetId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingPresetId && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingPresetId])

  const getTotalSec = () => {
    if (phase === 'work') return workSec
    if (phase === 'rest') return restSec
    return workSec
  }

  const displaySetNum = phase === 'work' ? setCount + 1 : phase === 'rest' ? setCount : 0
  const isRunning = state === 'running'
  const isIdle = phase === 'idle' && state === 'stopped'

  function handleMainBtn() {
    if (isIdle) {
      init(localWork, localRest, reps)
      startWork()
      playBeep(880, 0.2)
    } else {
      pauseResume()
    }
  }

  function handleReset() {
    reset()
    init(localWork, localRest)
  }

  function handleSelectPreset(preset: TimerPreset) {
    setSelectedPresetId(preset.id)
    setLocalWork(preset.work_sec)
    setLocalRest(preset.rest_sec)
    setReps(preset.reps)
    if (!isIdle) {
      reset()
      init(preset.work_sec, preset.rest_sec)
    }
  }

  async function handleSavePreset() {
    const name = saveNameInput.trim() || `루틴 ${presets.length + 1}`
    const supabase = createClient()
    const { data } = await supabase
      .from('timer_presets')
      .insert({ user_id: userId, name, work_sec: localWork, rest_sec: localRest, reps })
      .select()
      .single()
    if (data) {
      setPresets((prev) => [...prev, data])
      setSelectedPresetId(data.id)
    }
    setShowSaveForm(false)
    setSaveNameInput('')
  }

  async function handleRenamePreset(id: string) {
    const name = editingName.trim()
    if (!name) { setEditingPresetId(null); return }
    const supabase = createClient()
    await supabase.from('timer_presets').update({ name }).eq('id', id)
    setPresets((prev) => prev.map((p) => p.id === id ? { ...p, name } : p))
    setEditingPresetId(null)
  }

  async function handleDeletePreset(id: string) {
    const supabase = createClient()
    await supabase.from('timer_presets').delete().eq('id', id)
    setPresets((prev) => prev.filter((p) => p.id !== id))
    if (selectedPresetId === id) setSelectedPresetId(null)
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
        <CircleTimer remaining={remaining} total={getTotalSec()} phase={phase} isPaused={state === 'paused'} setNum={displaySetNum} />
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

      {/* 세팅 저장 */}
      {isIdle && (
        <div className="flex flex-col gap-2">
          {showSaveForm ? (
            <div className="flex gap-2">
              <Input
                className="flex-1 h-9 text-sm"
                placeholder={`루틴 ${presets.length + 1}`}
                value={saveNameInput}
                onChange={(e) => setSaveNameInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSavePreset() }}
                autoFocus
              />
              <Button size="sm" className="h-9 bg-zinc-700 hover:bg-zinc-600" onClick={handleSavePreset}>저장</Button>
              <Button size="sm" variant="ghost" className="h-9 text-zinc-500" onClick={() => { setShowSaveForm(false); setSaveNameInput('') }}>취소</Button>
            </div>
          ) : (
            <Button variant="outline" className="w-full h-9 text-sm text-zinc-400 border-zinc-700"
              onClick={() => { setShowSaveForm(true); setSaveNameInput('') }}>
              + 세팅 저장하기
            </Button>
          )}
        </div>
      )}

      {/* 프리셋 리스트 */}
      {presets.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-zinc-500 px-1">저장된 루틴</p>
          {presets.map((preset) => {
            const isSelected = selectedPresetId === preset.id
            const isEditing = editingPresetId === preset.id
            return (
              <div
                key={preset.id}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 cursor-pointer transition-colors
                  ${isSelected ? 'bg-zinc-700 ring-1 ring-zinc-500' : 'bg-zinc-900 hover:bg-zinc-800'}`}
                onClick={() => { if (!isEditing) handleSelectPreset(preset) }}
              >
                {/* 선택 표시 */}
                <div className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 transition-colors
                  ${isSelected ? 'border-green-400 bg-green-400' : 'border-zinc-600'}`} />

                {/* 이름 + 세팅 정보 */}
                <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                  {isEditing ? (
                    <input
                      ref={editInputRef}
                      className="bg-transparent border-b border-zinc-500 text-sm font-semibold w-full outline-none text-white"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={() => handleRenamePreset(preset.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenamePreset(preset.id)
                        if (e.key === 'Escape') setEditingPresetId(null)
                      }}
                    />
                  ) : (
                    <p className="text-sm font-semibold truncate">{preset.name}</p>
                  )}
                  <p className="text-xs text-zinc-500 mt-0.5">
                    운동 {preset.work_sec}초 · 휴식 {preset.rest_sec}초 · {preset.reps}회
                  </p>
                </div>

                {/* 이름 편집 버튼 */}
                {!isEditing ? (
                  <button
                    className="text-zinc-600 hover:text-zinc-300 text-xs shrink-0 px-1.5 py-0.5 rounded border border-zinc-700 hover:border-zinc-500 transition-colors"
                    onClick={(e) => { e.stopPropagation(); setEditingPresetId(preset.id); setEditingName(preset.name) }}
                  >수정</button>
                ) : (
                  <button
                    className="text-green-400 text-xs shrink-0 px-1.5 py-0.5 rounded border border-green-800 hover:border-green-600 transition-colors"
                    onClick={(e) => { e.stopPropagation(); handleRenamePreset(preset.id) }}
                  >저장</button>
                )}

                {/* 삭제 버튼 */}
                <button
                  className="text-zinc-600 hover:text-red-400 text-lg shrink-0 leading-none"
                  onClick={(e) => { e.stopPropagation(); handleDeletePreset(preset.id) }}
                >×</button>
              </div>
            )
          })}
        </div>
      )}

      <Button size="lg" className={`w-full h-16 text-xl font-bold mt-auto ${mainBtnClass}`} onClick={handleMainBtn}>
        {mainBtnLabel}
      </Button>
    </div>
  )
}
