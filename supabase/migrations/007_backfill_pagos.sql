-- Crea entradas en pagos para todos los usuarios que ya tienen predicciones
-- pero no tienen su entrada en pagos (usuarios que predijeron antes de que
-- se añadiera el upsert automático al guardar predicción).

INSERT INTO pagos (user_id, semana_id, pagado)
SELECT DISTINCT p.user_id, p.semana_id, false
FROM predicciones p
WHERE NOT EXISTS (
  SELECT 1 FROM pagos pg
  WHERE pg.user_id = p.user_id AND pg.semana_id = p.semana_id
)
ON CONFLICT (user_id, semana_id) DO NOTHING;
