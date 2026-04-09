import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TimerPageClient from './TimerPageClient'

export default async function TimerPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')
  const user = session.user

  const [settingsRes, presetsRes] = await Promise.all([
    supabase.from('workout_settings').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('timer_presets').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
  ])

  return (
    <TimerPageClient
      settings={settingsRes.data}
      userId={user.id}
      initialPresets={presetsRes.data ?? []}
    />
  )
}
