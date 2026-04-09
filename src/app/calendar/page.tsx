import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CalendarClient from './CalendarClient'

interface Props {
  searchParams: Promise<{ year?: string; month?: string }>
}

export default async function CalendarPage({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')
  const params = await searchParams
  const now = new Date()
  const year = parseInt(params.year ?? String(now.getFullYear()))
  const month = parseInt(params.month ?? String(now.getMonth() + 1))
  return <CalendarClient userId={session.user.id} year={year} month={month} />
}
