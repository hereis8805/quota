import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TimerPageClient from './TimerPageClient'

export default async function TimerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: settings } = await supabase
    .from('workout_settings')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  return <TimerPageClient settings={settings} userId={user.id} />
}
