-- ============================================
-- PORRA FÚTBOL - Soporte de administrador
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- Añadir columna is_admin a profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Política para que admins gestionen semanas (INSERT, UPDATE, DELETE)
CREATE POLICY "Admins gestionan semanas" ON semanas
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Política para que admins gestionen partidos (INSERT, UPDATE, DELETE)
CREATE POLICY "Admins gestionan partidos" ON partidos
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Política para que admins actualicen predicciones (marcar como correctas/incorrectas)
CREATE POLICY "Admins actualizan predicciones" ON predicciones
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- ============================================
-- INSTRUCCIONES: después de ejecutar este SQL,
-- márcate como admin con:
--   UPDATE profiles SET is_admin = true WHERE username = 'TU_USERNAME';
-- ============================================
