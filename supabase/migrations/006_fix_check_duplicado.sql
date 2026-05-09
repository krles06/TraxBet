-- Reemplaza la función de verificación de duplicados
-- Comprueba contra TODAS las predicciones de la semana,
-- independientemente de si el pago está confirmado o no.

CREATE OR REPLACE FUNCTION check_prediccion_duplicada(
  p_semana_id UUID,
  p_user_id UUID,
  p_predicciones JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_num_partidos INT;
  v_duplicate_count INT;
BEGIN
  SELECT jsonb_array_length(p_predicciones) INTO v_num_partidos;

  -- Busca cualquier otro usuario que tenga exactamente el mismo combinado completo
  SELECT COUNT(*) INTO v_duplicate_count
  FROM (
    SELECT pred.user_id
    FROM predicciones pred
    WHERE pred.semana_id = p_semana_id
      AND pred.user_id != p_user_id
      AND pred.partido_id IN (
        SELECT (elem->>'partido_id')::UUID
        FROM jsonb_array_elements(p_predicciones) AS elem
      )
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p_predicciones) AS elem
        WHERE (elem->>'partido_id')::UUID = pred.partido_id
          AND (elem->>'goles_local')::INT = pred.goles_local_prediccion
          AND (elem->>'goles_visitante')::INT = pred.goles_visitante_prediccion
      )
    GROUP BY pred.user_id
    HAVING COUNT(*) = v_num_partidos
  ) AS duplicados;

  RETURN v_duplicate_count > 0;
END;
$$;
