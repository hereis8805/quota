import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TimerPageClient from './TimerPageClient'

export default async function TimerPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')
  return <TimerPageClient userId={session.user.id} />
}
