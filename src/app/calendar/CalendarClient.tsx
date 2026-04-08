'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

interface Summary { date: string; total_score: number }
interface LogEntry { date: string; exercise_id: string; reps_done: number; score_earned: number }
interface ExerciseInfo { id: string; name: string; score_per_unit: number }

interface Props {
  year: number
  month: number
  summaries: Summary[]
  logs: LogEntry[]
  exercises: ExerciseInfo[]
}

function getMarker(score: number): string {
  if (score <= 100) return '✕'
  if (score <= 200) return '□'
  if (score <= 300) return '△'
  return '○'
}

function getMarkerColor(score: number): string {
  if (score <= 100) return 'text-red-500'
  if (score <= 200) return 'text-pink-400'
  if (score <= 300) return 'text-yellow-400'
  return 'text-green-400'
}

export default function CalendarClient({ year, month, summaries, logs, exercises }: Props) {
  const router = useRouter()
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const summaryMap = new Map(summaries.map((s) => [s.date, s]))
  const exerciseMap = new Map(exercises.map((e) => [e.id, e]))

  const daysInMonth = new Date(year, month, 0).getDate()
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay()
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const today = new Date().toISOString().split('T')[0]

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
                  <span className={`text-sm font-bold leading-none ${getMarkerColor(score)}`}>{getMarker(score)}</span>
                  <span className={`text-[10px] leading-none ${getMarkerColor(score)}`}>{score > 0 ? '+' : ''}{score}</span>
                </>
              )}
            </button>
          )
        })}
      </div>

      {/* 범례 */}
      <div className="flex gap-3 mt-4 justify-center text-xs text-zinc-500 flex-wrap">
        <span><span className="text-red-500">✕</span> ~100점</span>
        <span><span className="text-pink-400">□</span> ~200점</span>
        <span><span className="text-yellow-400">△</span> ~300점</span>
        <span><span className="text-green-400">○</span> 500점+</span>
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
