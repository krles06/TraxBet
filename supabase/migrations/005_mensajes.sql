CREATE TABLE IF NOT EXISTS mensajes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  texto TEXT NOT NULL CHECK (char_length(texto) <= 300),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE mensajes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mensajes visibles para todos" ON mensajes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuario puede enviar mensajes" ON mensajes
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
