-- ==============================================================================
-- GREENCHAIN / MAIZE ADVISOR — SUPABASE SCHEMA & POLICIES
-- Run this script in the Supabase Dashboard -> SQL Editor -> New query
-- ==============================================================================

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Karnataka Farmer',
  location TEXT NOT NULL DEFAULT 'Dharwad',
  preferred_lang TEXT NOT NULL DEFAULT 'kn' CHECK (preferred_lang IN ('kn', 'en')),
  crop_stage TEXT NOT NULL DEFAULT 'V4',
  soil_type TEXT NOT NULL DEFAULT 'black',
  weather_prefs JSONB DEFAULT '{"dToday": 60, "forecastRain72h": 0}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. CONVERSATIONS TABLE
CREATE TABLE IF NOT EXISTS public.conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Maize Advisory',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. MESSAGES TABLE
CREATE TABLE IF NOT EXISTS public.messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK (sender IN ('user', 'bot')),
  content TEXT NOT NULL,
  advisory JSONB,
  nlu_result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. ANALYTICS EVENTS TABLE (Non-blocking telemetry)
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  event_type TEXT NOT NULL,
  intent TEXT,
  location TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- PERFORMANCE INDEXES
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_msg ON public.conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at ASC);
CREATE INDEX IF NOT EXISTS idx_analytics_created ON public.analytics_events(created_at DESC);

-- ------------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Users can view own profile" 
  ON public.profiles FOR SELECT 
  USING (auth.uid()::text = id OR auth.role() = 'anon');

CREATE POLICY "Users can insert own profile" 
  ON public.profiles FOR INSERT 
  WITH CHECK (auth.uid()::text = id OR auth.role() = 'anon');

CREATE POLICY "Users can update own profile" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid()::text = id OR auth.role() = 'anon');

-- Conversations Policies
CREATE POLICY "Users can view own conversations" 
  ON public.conversations FOR SELECT 
  USING (auth.uid()::text = user_id OR auth.role() = 'anon');

CREATE POLICY "Users can create conversations" 
  ON public.conversations FOR INSERT 
  WITH CHECK (auth.uid()::text = user_id OR auth.role() = 'anon');

CREATE POLICY "Users can update own conversations" 
  ON public.conversations FOR UPDATE 
  USING (auth.uid()::text = user_id OR auth.role() = 'anon');

CREATE POLICY "Users can delete own conversations" 
  ON public.conversations FOR DELETE 
  USING (auth.uid()::text = user_id OR auth.role() = 'anon');

-- Messages Policies
CREATE POLICY "Users can view messages of their conversations" 
  ON public.messages FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations 
      WHERE public.conversations.id = public.messages.conversation_id
      AND (public.conversations.user_id = auth.uid()::text OR auth.role() = 'anon')
    )
  );

CREATE POLICY "Users can insert messages" 
  ON public.messages FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations 
      WHERE public.conversations.id = public.messages.conversation_id
      AND (public.conversations.user_id = auth.uid()::text OR auth.role() = 'anon')
    )
  );

-- Analytics Policies (Allow all clients to record telemetry)
CREATE POLICY "Anyone can log analytics" 
  ON public.analytics_events FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Admins can view analytics" 
  ON public.analytics_events FOR SELECT 
  USING (auth.role() = 'service_role' OR auth.role() = 'anon');

-- ------------------------------------------------------------------------------
-- AUTOMATIC TIMESTAMP TRIGGER FOR PROFILES
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
