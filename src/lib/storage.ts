import type { Exercise, DailyExerciseLog, TimerPreset } from '@/types'

const K = {
  exercises: 'quota_exercises',
  entries: (date: string) => `quota_entries_${date}`,
  timerPresets: 'quota_timer_presets',
  timerSettings: 'quota_timer_settings',
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const s = localStorage.getItem(key)
    return s ? (JSON.parse(s) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value))
}

// ── Exercises ──────────────────────────────────────────────

export function getExercises(): Exercise[] {
  return read<Exercise[]>(K.exercises, [])
}

export function saveExercises(exercises: Exercise[]) {
  write(K.exercises, exercises)
}

// ── Exercise Entries (개별 기록) ────────────────────────────

export interface ExerciseEntry {
  id: string
  exercise_id: string
  reps: number
  recorded_at: string
}

export function getEntries(date: string): ExerciseEntry[] {
  return read<ExerciseEntry[]>(K.entries(date), [])
}

function saveEntries(date: string, entries: ExerciseEntry[]) {
  write(K.entries(date), entries)
}

export function addEntry(date: string, exerciseId: string, reps: number): ExerciseEntry {
  const entry: ExerciseEntry = {
    id: crypto.randomUUID(),
    exercise_id: exerciseId,
    reps,
    recorded_at: new Date().toISOString(),
  }
  saveEntries(date, [...getEntries(date), entry])
  return entry
}

export function deleteEntry(date: string, entryId: string) {
  saveEntries(date, getEntries(date).filter((e) => e.id !== entryId))
}

export function resetDay(date: string) {
  localStorage.removeItem(K.entries(date))
}

// ── 파생 데이터: 일일 로그 / 점수 ──────────────────────────

export function computeLogs(date: string, exercises: Exercise[]): DailyExerciseLog[] {
  const entries = getEntries(date)
  const exerciseMap = new Map(exercises.map((e) => [e.id, e]))
  const grouped = new Map<string, number>()
  for (const e of entries) {
    grouped.set(e.exercise_id, (grouped.get(e.exercise_id) ?? 0) + e.reps)
  }
  return Array.from(grouped.entries()).map(([exerciseId, reps_done]) => {
    const ex = exerciseMap.get(exerciseId)
    return {
      id: exerciseId,
      user_id: 'local',
      exercise_id: exerciseId,
      date,
      reps_done,
      score_earned: ex ? reps_done * ex.score_per_unit : 0,
      updated_at: new Date().toISOString(),
    }
  })
}

export function getMonthData(year: number, month: number, exercises: Exercise[]) {
  const daysInMonth = new Date(year, month, 0).getDate()
  const summaries: { date: string; total_score: number }[] = []
  const logs: DailyExerciseLog[] = []
  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const dayLogs = computeLogs(date, exercises)
    if (dayLogs.length > 0) {
      summaries.push({ date, total_score: dayLogs.reduce((s, l) => s + l.score_earned, 0) })
      logs.push(...dayLogs)
    }
  }
  return { summaries, logs, exercises }
}

// ── Timer Presets ──────────────────────────────────────────

export function getTimerPresets(): TimerPreset[] {
  return read<TimerPreset[]>(K.timerPresets, [])
}

export function saveTimerPresets(presets: TimerPreset[]) {
  write(K.timerPresets, presets)
}

// ── Timer Settings ─────────────────────────────────────────

export interface TimerSettings {
  work_sec: number
  rest_sec: number
}

export function getTimerSettings(): TimerSettings {
  return read<TimerSettings>(K.timerSettings, { work_sec: 30, rest_sec: 90 })
}

export function saveTimerSettings(s: TimerSettings) {
  write(K.timerSettings, s)
}
