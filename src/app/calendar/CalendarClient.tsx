'use client'

import { useState, useEffect } from 'react'
import useSWR from 'swr'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { getMarkerThresholds, saveMarkerThresholds, getMarker, getMarkerColor, type MarkerThresholds } from '@/lib/markerThresholds'
import { Input } from '@/components/ui/input'

interface Summary { date: string; total_score: number }
interface LogEntry { date: string; exercise_id: string; reps_done: number; score_earned: number }
interface ExerciseInfo { id: string; name: string; score_per_unit: number }

interface Props {
  userId: string
  year: number
  month: number
}

export default function CalendarClient({ userId, year, month }: Props) {
  const router = useRouter()
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [thresholds, setThresholds] = useState<MarkerThresholds>({ x: 100, square: 200, triangle: 300 })
  const [showThresholdEditor, setShowThresholdEditor] = useState(false)
  const [thresholdSaved, setThresholdSaved] = useState(false)
  const [thresholdError, setThresholdError] = useState<string | null>(null)

  useEffect(() => {
    setThresholds(getMarkerThresholds())
  }, [])

  function handleThresholdInput(key: keyof MarkerThresholds, value: string) {
    const n = parseInt(value)
    if (!isNaN(n) && n >= 1) setThresholds((t) => ({ ...t, [key]: n }))
    else if (value === '') setThresholds((t) => ({ ...t, [key]: 0 }))
  }

  function handleSaveThresholds() {
    if (thresholds.x >= thresholds.square) {
      setThresholdError('✕ 점수는 □ 점수보다 작아야 합니다.')
      return
    }
    if (thresholds.square >= thresholds.triangle) {
      setThresholdError('□ 점수는 △ 점수보다 작아야 합니다.')
      return
    }
    setThresholdError(null)
    saveMarkerThresholds(thresholds)
    setThresholdSaved(true)
    setTimeout(() => { setThresholdSaved(false); setShowThresholdEditor(false) }, 1000)
  }

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`

  const { data, isLoading } = useSWR(
    `calendar-${userId}-${year}-${month}`,
    async () => {
      const supabase = createClient()
      const [summaryRes, logsRes, exercisesRes] = await Promise.all([
        supabase
          .from('daily_score_summary')
          .select('date, total_score')
          .eq('user_id', userId)
          .gte('date', startDate)
          .lte('date', endDate),
        supabase
          .from('daily_exercise_logs')
          .select('date, exercise_id, reps_done, score_earned')
          .eq('user_id', userId)
          .gte('date', startDate)
          .lte('date', endDate),
        supabase
          .from('exercises')
          .select('id, name, score_per_unit')
          .eq('user_id', userId),
      ])
      return {
        summaries: summaryRes.data ?? [],
        logs: logsRes.data ?? [],
        exercises: exercisesRes.data ?? [],
      }
    },
    { revalidateOnFocus: false }
  )

  const summaries: Summary[] = data?.summaries ?? []
  const logs: LogEntry[] = data?.logs ?? []
  const exercises: ExerciseInfo[] = data?.exercises ?? []

  const summaryMap = new Map(summaries.map((s) => [s.date, s]))
  const exerciseMap = new Map(exercises.map((e) => [e.id, e]))

  const daysInMonth = new Date(year, month, 0).getDate()
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay()
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date())

  function getDayLogs(date: string) {
    return logs.filter((l) => l.date === date)
  }

  function prevMonth() {
    const d = new Date(year, month - 2, 1)
    router.push(`/calendar?year=${d.getFullYear()}&month=${d.getMonth() + 1}`)
  }
  function nextMonth() {
    const d = new Date(year, month, 1)
    router.push(`/calendar?year=${d.getFullYear()}&month=${d.getMonth() + 1}`)
  }

  const selectedLogs = selectedDate ? getDayLogs(selectedDate) : []
  const selectedSummary = selectedDate ? summaryMap.get(selectedDate) : null

  return (
    <div className="min-h-screen max-w-md mx-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <Link href="/dashboard" className="text-zinc-400 hover:text-white text-sm">← 대시보드</Link>
        <h1 className="text-lg font-bold">{year}년 {month}월</h1>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={prevMonth}>‹</Button>
          <Button variant="ghost" size="sm" onClick={nextMonth}>›</Button>
        </div>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 mb-1">
        {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
          <div key={d} className="text-center text-xs text-zinc-500 py-1">{d}</div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      {isLoading && summaries.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-zinc-500 text-sm animate-pulse">로딩 중...</p>
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`e-${i}`} />)}
          {days.map((day) => {
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const summary = summaryMap.get(dateStr)
            const isToday = dateStr === today
            const score = summary?.total_score ?? null

            return (
              <button
                key={day}
                onClick={() => score !== null && setSelectedDate(dateStr)}
                className={`
                  flex flex-col items-center justify-center aspect-square rounded-lg text-sm gap-0.5
                  ${isToday ? 'ring-2 ring-blue-500' : ''}
                  ${score !== null ? 'bg-zinc-800 hover:bg-zinc-700 cursor-pointer' : 'bg-zinc-900 cursor-default'}
                `}
              >
                <span className={`text-xs leading-none ${isToday ? 'text-blue-400 font-bold' : 'text-zinc-400'}`}>{day}</span>
                {score !== null && (
                  <>
                    <span className={`text-sm font-bold leading-none ${getMarkerColor(score, thresholds)}`}>{getMarker(score, thresholds)}</span>
                    <span className={`text-[10px] leading-none ${getMarkerColor(score, thresholds)}`}>{score > 0 ? '+' : ''}{score}</span>
                  </>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* 범례 + 설정 */}
      <div className="mt-4 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowThresholdEditor((v) => !v)}
            className={`text-base leading-none px-1.5 py-1 rounded transition-colors shrink-0 ${showThresholdEditor ? 'text-blue-400 bg-blue-400/10' : 'text-zinc-600 hover:text-zinc-400'}`}
            aria-label="마커 기준점 설정"
          >⚙</button>
          <div className="flex-1 flex gap-3 text-xs text-zinc-500 justify-center flex-wrap">
            <span><span className="text-red-500">✕</span> ~{thresholds.x}점</span>
            <span><span className="text-pink-400">□</span> ~{thresholds.square}점</span>
            <span><span className="text-yellow-400">△</span> ~{thresholds.triangle}점</span>
            <span><span className="text-green-400">○</span> {thresholds.triangle + 1}점~</span>
          </div>
        </div>

        {showThresholdEditor && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex flex-col gap-3">
            <p className="text-xs text-zinc-500">마커 기준점 (점수 이하)</p>
            <div className="grid grid-cols-3 gap-2">
              {([
                { key: 'x' as keyof MarkerThresholds, label: '✕', color: 'text-red-500' },
                { key: 'square' as keyof MarkerThresholds, label: '□', color: 'text-pink-400' },
                { key: 'triangle' as keyof MarkerThresholds, label: '△', color: 'text-yellow-400' },
              ]).map(({ key, label, color }) => (
                <div key={key} className="flex flex-col gap-1">
                  <label className={`text-xs font-bold text-center ${color}`}>{label}</label>
                  <Input
                    type="number" min={1}
                    className="text-center h-9 px-1 text-sm"
                    value={thresholds[key] || ''}
                    onChange={(e) => { setThresholdError(null); handleThresholdInput(key, e.target.value) }}
                  />
                </div>
              ))}
            </div>
            {thresholdError && (
              <p className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{thresholdError}</p>
            )}
            <Button
              size="sm"
              className={`w-full ${thresholdSaved ? 'bg-green-600 hover:bg-green-600' : 'bg-blue-600 hover:bg-blue-700'}`}
              onClick={handleSaveThresholds}
            >
              {thresholdSaved ? '저장됨 ✓' : '저장'}
            </Button>
          </div>
        )}
      </div>

      {/* 날짜 상세 팝업 */}
      <Dialog open={!!selectedDate} onOpenChange={(o) => !o && setSelectedDate(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{selectedDate} 기록</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-bold ${(selectedSummary?.total_score ?? 0) < 0 ? 'text-red-400' : 'text-green-400'}`}>
                {(selectedSummary?.total_score ?? 0) > 0 ? '+' : ''}{selectedSummary?.total_score ?? 0}점
              </span>
              <span className="text-zinc-400 text-sm">총점</span>
            </div>

            {selectedLogs.length === 0 ? (
              <p className="text-zinc-500 text-sm">기록이 없습니다.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {selectedLogs.map((log) => {
                  const ex = exerciseMap.get(log.exercise_id)
                  if (!ex) return null
                  return (
                    <div key={log.exercise_id} className="flex items-center justify-between bg-zinc-900 rounded-lg px-3 py-2.5">
                      <div>
                        <span className="font-medium">{ex.name}</span>
                        {ex.score_per_unit < 0 && (
                          <Badge variant="outline" className="ml-2 text-red-400 border-red-800 text-xs">마이너스</Badge>
                        )}
                        <p className="text-xs text-zinc-500 mt-0.5">{log.reps_done}회</p>
                      </div>
                      <span className={`font-bold ${log.score_earned < 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {log.score_earned > 0 ? '+' : ''}{log.score_earned}점
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
