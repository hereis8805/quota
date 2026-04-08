-- exercise_entries: 운동별 개별 기록 (시각 + 횟수)
CREATE TABLE IF NOT EXISTS public.exercise_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  reps        INT NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.exercise_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exercise_entries: 본인만" ON public.exercise_entries
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_exercise_entries_user_date
  ON public.exercise_entries (user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_exercise_entries_exercise
  ON public.exercise_entries (exercise_id, date DESC);
