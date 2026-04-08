-- ============================================================
-- Workout Mission Tracker - Database Schema
-- ============================================================

-- 1. profiles 테이블
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT,
  display_name TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles: 본인만 조회" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles: 본인만 수정" ON public.profiles
  FOR ALL USING (auth.uid() = id);

-- 신규 사용자 가입 시 profile 자동 생성
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 2. workout_settings 테이블
CREATE TABLE IF NOT EXISTS public.workout_settings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  exercise_name     TEXT NOT NULL DEFAULT '풀업',
  daily_target      INT  NOT NULL DEFAULT 50,
  interval_work_sec INT  NOT NULL DEFAULT 30,
  interval_rest_sec INT  NOT NULL DEFAULT 90,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.workout_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workout_settings: 본인만" ON public.workout_settings
  FOR ALL USING (auth.uid() = user_id);


-- 3. workout_logs 테이블 (날짜 + user_id 유니크)
CREATE TABLE IF NOT EXISTS public.workout_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date             DATE NOT NULL,
  total_reps       INT  NOT NULL DEFAULT 0,
  achievement_rate NUMERIC(5,2) DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, date)
);

ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workout_logs: 본인만" ON public.workout_logs
  FOR ALL USING (auth.uid() = user_id);

-- achievement_rate 자동 갱신 함수
CREATE OR REPLACE FUNCTION public.update_achievement_rate()
RETURNS TRIGGER AS $$
DECLARE
  v_target INT;
BEGIN
  SELECT daily_target INTO v_target
  FROM public.workout_settings
  WHERE user_id = NEW.user_id
  LIMIT 1;

  IF v_target IS NOT NULL AND v_target > 0 THEN
    NEW.achievement_rate := ROUND((NEW.total_reps::NUMERIC / v_target) * 100, 2);
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_achievement ON public.workout_logs;
CREATE TRIGGER trg_update_achievement
  BEFORE INSERT OR UPDATE ON public.workout_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_achievement_rate();


-- 4. set_details 테이블
CREATE TABLE IF NOT EXISTS public.set_details (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id            UUID NOT NULL REFERENCES public.workout_logs(id) ON DELETE CASCADE,
  set_number        INT  NOT NULL,
  reps_done         INT  NOT NULL,
  rest_duration_sec INT  DEFAULT 0,
  recorded_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.set_details ENABLE ROW LEVEL SECURITY;

-- set_details는 log_id → workout_logs.user_id 경유하여 본인 확인
CREATE POLICY "set_details: 본인만" ON public.set_details
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.workout_logs wl
      WHERE wl.id = set_details.log_id
        AND wl.user_id = auth.uid()
    )
  );


-- ============================================================
-- 인덱스
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_workout_logs_user_date  ON public.workout_logs (user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_set_details_log_id      ON public.set_details  (log_id);
CREATE INDEX IF NOT EXISTS idx_workout_settings_user   ON public.workout_settings (user_id);
