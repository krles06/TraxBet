CREATE TABLE IF NOT EXISTS reacciones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  semana_id UUID REFERENCES semanas(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  emoji TEXT NOT NULL CHECK (emoji IN ('🔥', '😅', '💪', '😭')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, semana_id)
);

ALTER TABLE reacciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reacciones visibles para todos" ON reacciones
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuario puede reaccionar" ON reacciones
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Usuario puede cambiar su reacción" ON reacciones
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Usuario puede borrar su reacción" ON reacciones
  FOR DELETE TO authenticated USING (user_id = auth.uid());
