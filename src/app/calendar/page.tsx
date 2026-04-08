import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CalendarClient from './CalendarClient'

interface Props {
  searchParams: Promise<{ year?: string; month?: string }>
}

export default async function CalendarPage({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const now = new Date()
  const year = parseInt(params.year ?? String(now.getFullYear()))
  const month = parseInt(params.month ?? String(now.getMonth() + 1))

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate = new Date(year, month, 0).toISOString().split('T')[0]

  // 월별 총점 요약 + 각 날짜의 운동 로그
  const [summaryRes, logsRes, exercisesRes] = await Promise.all([
    supabase
      .from('daily_score_summary')
      .select('date, total_score')
      .eq('user_id', user.id)
      .gte('date', startDate)
      .lte('date', endDate),
    supabase
      .from('daily_exercise_logs')
      .select('date, exercise_id, reps_done, score_earned')
      .eq('user_id', user.id)
      .gte('date', startDate)
      .lte('date', endDate),
    supabase
      .from('exercises')
      .select('id, name, score_per_unit')
      .eq('user_id', user.id),
  ])

  return (
    <CalendarClient
      year={year}
      month={month}
      summaries={summaryRes.data ?? []}
      logs={logsRes.data ?? []}
      exercises={exercisesRes.data ?? []}
    />
  )
}
