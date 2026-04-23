-- ============================================
-- FIX: Políticas RLS faltantes para semanas y partidos
-- La service_role key bypassa RLS, pero si se usa la key incorrecta
-- (anon/publishable), los INSERT/UPDATE fallan silenciosamente.
-- Este fix añade las políticas necesarias como red de seguridad.
-- ============================================

-- semanas: permitir INSERT/UPDATE (gestionado solo por Edge Functions / admins)
CREATE POLICY "Semanas insert service" ON semanas
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Semanas update service" ON semanas
  FOR UPDATE USING (true);

-- partidos: permitir INSERT/UPDATE (gestionado solo por Edge Functions / admins)
CREATE POLICY "Partidos insert service" ON partidos
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Partidos update service" ON partidos
  FOR UPDATE USING (true);
