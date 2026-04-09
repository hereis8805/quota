import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')
  const user = session.user

  const today = new Date().toISOString().split('T')[0]

  const [exercisesRes, logsRes, summaryRes] = await Promise.all([
    supabase
      .from('exercises')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('order_index', { ascending: true }),
    supabase
      .from('daily_exercise_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today),
    supabase
      .from('daily_score_summary')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .maybeSingle(),
  ])

  return (
    <DashboardClient
      userId={user.id}
      today={today}
      exercises={exercisesRes.data ?? []}
      logs={logsRes.data ?? []}
      summary={summaryRes.data}
    />
  )
}
