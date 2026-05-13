import CalendarClient from './CalendarClient'

interface Props {
  searchParams: Promise<{ year?: string; month?: string }>
}

export default async function CalendarPage({ searchParams }: Props) {
  const params = await searchParams
  const now = new Date()
  const year = parseInt(params.year ?? String(now.getFullYear()))
  const month = parseInt(params.month ?? String(now.getMonth() + 1))
  return <CalendarClient year={year} month={month} />
}
