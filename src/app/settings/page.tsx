import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SettingsClient from './SettingsClient'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')
  const user = session.user

  const { data: exercises } = await supabase
    .from('exercises')
    .select('*')
    .eq('user_id', user.id)
    .order('order_index', { ascending: true })

  return <SettingsClient userId={user.id} exercises={exercises ?? []} />
}
