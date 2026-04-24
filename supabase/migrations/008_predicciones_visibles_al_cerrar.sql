-- Permite ver las predicciones de todos una vez la semana está cerrada o resuelta,
-- no solo cuando el partido ha finalizado.

DROP POLICY IF EXISTS "Ver predicciones propias" ON predicciones;

CREATE POLICY "Ver predicciones propias" ON predicciones FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM partidos p
      WHERE p.id = partido_id AND p.estado = 'finalizado'
    )
    OR EXISTS (
      SELECT 1 FROM semanas s
      WHERE s.id = semana_id AND s.estado IN ('cerrada', 'resuelta')
    )
  );
