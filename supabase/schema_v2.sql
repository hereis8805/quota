-- ============================================================
-- Workout Mission Tracker v2 - 점수 기반 운동 관리
-- ============================================================
-- 기존 schema.sql 실행 후 이 파일을 추가 실행하세요.

-- 1. exercises 테이블 (운동 목록)
CREATE TABLE IF NOT EXISTS public.exercises (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  daily_target INT NOT NULL DEFAULT 1,
  score_per_unit NUMERIC NOT NULL DEFAULT 1,  -- 음수면 마이너스 항목
  order_index INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exercises: 본인만" ON public.exercises
  FOR ALL USING (auth.uid() = user_id);

-- 2. daily_exercise_logs 테이블 (운동별 일일 기록)
-- user_id + exercise_id + date 조합 유니크 (upsert 용)
CREATE TABLE IF NOT EXISTS public.daily_exercise_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  exercise_id  UUID NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  date         DATE NOT NULL,
  reps_done    INT NOT NULL DEFAULT 0,
  score_earned NUMERIC NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, exercise_id, date)
);

ALTER TABLE public.daily_exercise_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "daily_exercise_logs: 본인만" ON public.daily_exercise_logs
  FOR ALL USING (auth.uid() = user_id);

-- 3. daily_score_summary 테이블 (달력용 일별 총점)
CREATE TABLE IF NOT EXISTS public.daily_score_summary (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  total_score NUMERIC NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, date)
);

ALTER TABLE public.daily_score_summary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "daily_score_summary: 본인만" ON public.daily_score_summary
  FOR ALL USING (auth.uid() = user_id);

-- 4. workout_settings에 타이머 전용 컬럼만 남기기 (없으면 생성)
-- 기존 테이블이 있다면 exercise_name, daily_target 컬럼은 무시하고 타이머만 사용

-- ============================================================
-- 인덱스
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_exercises_user        ON public.exercises (user_id, order_index);
CREATE INDEX IF NOT EXISTS idx_daily_logs_user_date  ON public.daily_exercise_logs (user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_logs_exercise   ON public.daily_exercise_logs (exercise_id);
CREATE INDEX IF NOT EXISTS idx_score_summary_user    ON public.daily_score_summary (user_id, date DESC);
