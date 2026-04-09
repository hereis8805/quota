export interface Profile {
  id: string
  email: string | null
  display_name: string | null
  created_at: string
}

export interface Exercise {
  id: string
  user_id: string
  name: string
  daily_target: number
  score_per_unit: number   // 음수면 마이너스 항목
  order_index: number
  is_active: boolean
  created_at: string
}

export interface DailyExerciseLog {
  id: string
  user_id: string
  exercise_id: string
  date: string
  reps_done: number
  score_earned: number
  updated_at: string
}

export interface DailyScoreSummary {
  id: string
  user_id: string
  date: string
  total_score: number
  updated_at: string
}

export interface WorkoutSettings {
  id: string
  user_id: string
  interval_work_sec: number
  interval_rest_sec: number
}

export interface SetDetail {
  id: string
  log_id: string
  set_number: number
  reps_done: number
  rest_duration_sec: number
  recorded_at: string
}

export interface TimerPreset {
  id: string
  user_id: string
  name: string
  work_sec: number
  rest_sec: number
  reps: number
  created_at: string
}

export type TimerPhase = 'idle' | 'work' | 'rest'
export type TimerState = 'stopped' | 'running' | 'paused'
