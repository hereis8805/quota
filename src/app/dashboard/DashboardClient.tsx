'use client'

import { useState, useEffect, useRef } from 'react'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import type { Exercise, DailyExerciseLog, DailyScoreSummary } from '@/types'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface ExerciseEntry {
  id: string
  exercise_id: string
  reps: number
  recorded_at: string
}

interface Props {
  userId: string
}

export default function DashboardClient({ userId }: Props) {
  const router = useRouter()
  const today = new Date().toISOString().split('T')[0]

  const { data: dashData, isLoading } = useSWR(
    `dashboard-${userId}-${today}`,
    async () => {
      const supabase = createClient()
      const [exercisesRes, logsRes, summaryRes] = await Promise.all([
        supabase
          .from('exercises')
          .select('*')
          .eq('user_id', userId)
          .eq('is_active', true)
          .order('order_index', { ascending: true }),
        supabase
          .from('daily_exercise_logs')
          .select('*')
          .eq('user_id', userId)
          .eq('date', today),
        supabase
          .from('daily_score_summary')
          .select('*')
          .eq('user_id', userId)
          .eq('date', today)
          .maybeSingle(),
      ])
      return {
        exercises: exercisesRes.data ?? [],
        logs: logsRes.data ?? [],
        summary: summaryRes.data ?? null,
      }
    },
    { revalidateOnFocus: false }
  )

  const [logs, setLogs] = useState<DailyExerciseLog[]>([])
  const [totalScore, setTotalScore] = useState(0)
  const initialized = useRef(false)

  useEffect(() => {
    if (dashData && !initialized.current) {
      setLogs(dashData.logs)
      setTotalScore(dashData.summary?.total_score ?? 0)
      initialized.current = true
    }
  }, [dashData])

  const exercises: Exercise[] = dashData?.exercises ?? []

  const [selected, setSelected] = useState<Exercise | null>(null)
  const [entries, setEntries] = useState<ExerciseEntry[]>([])
  const [repsInput, setRepsInput] = useState('1')
  const [saving, setSaving] = useState(false)

  const [showDayDetail, setShowDayDetail] = useState(false)
  const [dayEntries, setDayEntries] = useState<ExerciseEntry[]>([])
  const [dayLoading, setDayLoading] = useState(false)

  const [showResetConfirm, setShowResetConfirm] = useState(false)

  const exerciseMap = new Map(exercises.map((e) => [e.id, e]))

  // 마이너스 항목 맨 뒤로
  const sortedExercises = [...exercises].sort((a, b) => {
    const aIsNeg = a.score_per_unit < 0 ? 1 : 0
    const bIsNeg = b.score_per_unit < 0 ? 1 : 0
    if (aIsNeg !== bIsNeg) return aIsNeg - bIsNeg
    return a.order_index - b.order_index
  })

  function getLog(exerciseId: string) {
    return logs.find((l) => l.exercise_id === exerciseId)
  }

  async function openExercise(ex: Exercise) {
    setSelected(ex)
    setRepsInput('1')
    const supabase = createClient()
    const { data } = await supabase
      .from('exercise_entries')
      .select('id, exercise_id, reps, recorded_at')
      .eq('user_id', userId)
      .eq('exercise_id', ex.id)
      .eq('date', today)
      .order('recorded_at', { ascending: false })
    setEntries(data ?? [])
  }

  async function openDayDetail() {
    setShowDayDetail(true)
    setDayLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('exercise_entries')
      .select('id, exercise_id, reps, recorded_at')
      .eq('user_id', userId)
      .eq('date', today)
      .order('recorded_at', { ascending: true })
    setDayEntries(data ?? [])
    setDayLoading(false)
  }

  async function handleLog() {
    if (!selected || saving) return
    const reps = parseInt(repsInput)
    if (isNaN(reps) || reps < 1) return
    setSaving(true)

    const supabase = createClient()
    await supabase.from('exercise_entries').insert({
      user_id: userId, exercise_id: selected.id, date: today, reps,
    })

    const existingLog = getLog(selected.id)
    const newReps = (existingLog?.reps_done ?? 0) + reps
    const newScore = newReps * selected.score_per_unit

    const { data: updatedLog } = await supabase
      .from('daily_exercise_logs')
      .upsert({
        id: existingLog?.id,
        user_id: userId,
        exercise_id: selected.id,
        date: today,
        reps_done: newReps,
        score_earned: newScore,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,exercise_id,date' })
      .select().single()

    if (updatedLog) {
      setLogs((prev) => {
        const exists = prev.find((l) => l.exercise_id === selected.id)
        return exists
          ? prev.map((l) => l.exercise_id === selected.id ? updatedLog : l)
          : [...prev, updatedLog]
      })
    }

    const allLogs = logs.map((l) =>
      l.exercise_id === selected.id ? { ...l, score_earned: newScore } : l
    )
    if (!existingLog) allLogs.push({ exercise_id: selected.id, score_earned: newScore } as DailyExerciseLog)
    const newTotal = allLogs.reduce((sum, l) => sum + l.score_earned, 0)

    await supabase.from('daily_score_summary').upsert({
      user_id: userId, date: today, total_score: newTotal,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,date' })
    setTotalScore(newTotal)

    setRepsInput('1')
    setSaving(false)
    setSelected(null)
  }

  async function handleDeleteEntry(entry: ExerciseEntry) {
    if (!selected) return
    const supabase = createClient()

    await supabase.from('exercise_entries').delete().eq('id', entry.id)

    const existingLog = getLog(selected.id)
    const newReps = Math.max(0, (existingLog?.reps_done ?? 0) - entry.reps)
    const newScore = newReps * selected.score_per_unit

    let newLogs: DailyExerciseLog[]
    if (newReps === 0) {
      await supabase.from('daily_exercise_logs')
        .delete().eq('user_id', userId).eq('exercise_id', selected.id).eq('date', today)
      newLogs = logs.filter((l) => l.exercise_id !== selected.id)
    } else {
      await supabase.from('daily_exercise_logs')
        .update({ reps_done: newReps, score_earned: newScore, updated_at: new Date().toISOString() })
        .eq('user_id', userId).eq('exercise_id', selected.id).eq('date', today)
      newLogs = logs.map((l) => l.exercise_id === selected.id ? { ...l, reps_done: newReps, score_earned: newScore } : l)
    }
    setLogs(newLogs)

    const newTotal = newLogs.reduce((sum, l) => sum + l.score_earned, 0)
    await supabase.from('daily_score_summary').upsert({
      user_id: userId, date: today, total_score: newTotal,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,date' })
    setTotalScore(newTotal)

    setEntries((prev) => prev.filter((e) => e.id !== entry.id))
  }

  async function handleResetToday() {
    const supabase = createClient()
    await Promise.all([
      supabase.from('exercise_entries').delete().eq('user_id', userId).eq('date', today),
      supabase.from('daily_exercise_logs').delete().eq('user_id', userId).eq('date', today),
      supabase.from('daily_score_summary').delete().eq('user_id', userId).eq('date', today),
    ])
    setLogs([])
    setTotalScore(0)
    setShowResetConfirm(false)
    router.refresh()
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const todayStr = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })

  if (isLoading && !dashData) {
    return (
      <div className="h-screen max-w-md mx-auto flex items-center justify-center">
        <p className="text-zinc-500 text-sm animate-pulse">로딩 중...</p>
      </div>
    )
  }

  return (
    <div className="h-screen max-w-md mx-auto flex flex-col overflow-hidden">

      {/* ── 고정 상단: 헤더 + 총점 ── */}
      <div className="shrink-0 bg-background px-4 pt-4 pb-2 flex flex-col gap-3 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">{todayStr}</h1>
          <nav className="flex gap-1">
            <Link href="/calendar"><Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white px-2">달력</Button></Link>
            <Link href="/timer"><Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white px-2">타이머</Button></Link>
            <Link href="/settings"><Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white px-2">운동설정</Button></Link>
            <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white px-2" onClick={handleLogout}>로그아웃</Button>
          </nav>
        </div>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="flex items-center justify-between py-3 px-5">
            <div className="cursor-pointer flex-1" onClick={openDayDetail}>
              <p className="text-zinc-400 text-xs">오늘 총점 <span className="text-zinc-600">↗ 상세</span></p>
              <p className={`text-4xl font-bold mt-0.5 ${totalScore < 0 ? 'text-red-400' : totalScore === 0 ? 'text-zinc-400' : 'text-green-400'}`}>
                {totalScore > 0 ? '+' : ''}{totalScore}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {totalScore >= 500 && <span className="text-3xl animate-bounce">🎉</span>}
              <Button variant="outline" size="sm"
                className="text-zinc-500 border-zinc-700 hover:text-red-400 hover:border-red-800"
                onClick={() => setShowResetConfirm(true)}>
                초기화
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── 스크롤 운동 리스트 ── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
        {exercises.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-zinc-400">
              <p>등록된 운동이 없습니다.</p>
              <Link href="/settings" className="text-blue-400 underline mt-2 block">운동 설정하기</Link>
            </CardContent>
          </Card>
        ) : (
          sortedExercises.map((ex) => {
            const log = getLog(ex.id)
            const done = log?.reps_done ?? 0
            const remaining = Math.max(0, ex.daily_target - done)
            const pct = ex.daily_target > 0 ? Math.min(100, Math.round((done / ex.daily_target) * 100)) : 0
            const score = log?.score_earned ?? 0
            const isNegative = ex.score_per_unit < 0

            return (
              <button key={ex.id} onClick={() => openExercise(ex)} className="w-full text-left">
                <Card className={`hover:bg-zinc-800 transition-colors active:scale-[0.98] ${isNegative && done > 0 ? 'border-red-900' : ''}`}>
                  <CardContent className="py-4 px-5">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-base">{ex.name}</span>
                        {isNegative && <Badge variant="outline" className="text-red-400 border-red-800 text-xs">마이너스</Badge>}
                      </div>
                      <span className={`font-bold text-lg ${score < 0 ? 'text-red-400' : score > 0 ? 'text-green-400' : 'text-zinc-500'}`}>
                        {score > 0 ? '+' : ''}{score}점
                      </span>
                    </div>
                    {isNegative ? (
                      <p className="text-sm text-zinc-400">{done}회 기록</p>
                    ) : (
                      <>
                        <div className="flex justify-between text-sm text-zinc-400 mb-1">
                          <span>{done} / {ex.daily_target}회</span>
                          <span>{remaining > 0 ? `${remaining}개 남음` : '완료 ✓'}</span>
                        </div>
                        <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${pct >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-xs text-zinc-500 mt-1">{pct}% 달성</p>
                      </>
                    )}
                  </CardContent>
                </Card>
              </button>
            )
          })
        )}
      </div>

      {/* ── 다이얼로그들 ── */}

      {/* 운동별 기록 */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{selected?.name}</DialogTitle></DialogHeader>
          {selected && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Button variant="outline" className="w-11 h-11 text-xl shrink-0"
                  onClick={() => setRepsInput(String(Math.max(1, parseInt(repsInput || '1') - 1)))}>−</Button>
                <Input type="number" min={1} className="text-center text-2xl font-bold h-11"
                  value={repsInput} onChange={(e) => setRepsInput(e.target.value)}
                  onFocus={(e) => e.target.select()} />
                <Button variant="outline" className="w-11 h-11 text-xl shrink-0"
                  onClick={() => setRepsInput(String(parseInt(repsInput || '0') + 1))}>+</Button>
                <span className="text-zinc-400 text-sm shrink-0">회</span>
                <Button
                  className={`flex-1 h-11 font-semibold ${selected.score_per_unit < 0 ? 'bg-red-700 hover:bg-red-800' : 'bg-green-600 hover:bg-green-700'}`}
                  onClick={handleLog} disabled={saving}>
                  {saving ? '...' : '기록'}
                </Button>
              </div>
              <div className="flex flex-col gap-1 max-h-56 overflow-y-auto">
                {entries.map((entry, i) => (
                  <div key={entry.id} className="flex items-center justify-between bg-zinc-900 rounded-lg px-3 py-2">
                    <span className="text-zinc-400 text-sm">
                      {new Date(entry.recorded_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="font-semibold">{entry.reps}회</span>
                    <div className="flex items-center gap-2">
                      {i === 0 && <span className="text-xs text-zinc-600">최근</span>}
                      <button
                        className="text-zinc-600 hover:text-red-400 text-lg leading-none transition-colors"
                        onClick={() => handleDeleteEntry(entry)}
                      >×</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 하루 전체 기록 */}
      <Dialog open={showDayDetail} onOpenChange={setShowDayDetail}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>오늘 운동 기록</DialogTitle></DialogHeader>
          {dayLoading ? (
            <p className="text-center text-zinc-400 py-4">로딩 중...</p>
          ) : dayEntries.length === 0 ? (
            <p className="text-center text-zinc-500 py-4">아직 기록이 없습니다.</p>
          ) : (
            <div className="flex flex-col gap-1.5 max-h-96 overflow-y-auto">
              {dayEntries.map((entry) => {
                const ex = exerciseMap.get(entry.exercise_id)
                if (!ex) return null
                const score = entry.reps * ex.score_per_unit
                return (
                  <div key={entry.id} className="flex items-center justify-between bg-zinc-900 rounded-lg px-3 py-2.5">
                    <span className="text-zinc-400 text-sm w-14 shrink-0">
                      {new Date(entry.recorded_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="flex-1 font-medium px-2">{ex.name}</span>
                    <span className="text-zinc-400 text-sm w-12 text-right shrink-0">{entry.reps}회</span>
                    <span className={`font-bold w-16 text-right shrink-0 ${score < 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {score > 0 ? '+' : ''}{score}점
                    </span>
                  </div>
                )
              })}
              <div className="flex justify-between px-3 py-2 border-t border-zinc-800 mt-1">
                <span className="text-zinc-400 text-sm">합계</span>
                <span className={`font-bold ${totalScore < 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {totalScore > 0 ? '+' : ''}{totalScore}점
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 초기화 확인 */}
      <Dialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>오늘 기록 초기화</DialogTitle></DialogHeader>
          <p className="text-zinc-400 text-sm">오늘의 모든 운동 기록과 점수가 삭제됩니다.</p>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowResetConfirm(false)}>취소</Button>
            <Button className="flex-1 bg-red-700 hover:bg-red-800" onClick={handleResetToday}>초기화</Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}
