-- ============================================
-- SCRIPT DE DIAGNÓSTICO - ejecutar en Supabase SQL Editor
-- ============================================

-- 1. Ver qué políticas RLS existen actualmente
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename IN ('semanas', 'partidos', 'predicciones', 'profiles')
ORDER BY tablename, cmd;

-- 2. Contar filas en cada tabla
SELECT 'semanas' as tabla, COUNT(*) as filas FROM semanas
UNION ALL
SELECT 'partidos', COUNT(*) FROM partidos
UNION ALL
SELECT 'predicciones', COUNT(*) FROM predicciones
UNION ALL
SELECT 'profiles', COUNT(*) FROM profiles;

-- 3. Verificar que RLS está activado
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('semanas', 'partidos', 'predicciones', 'profiles', 'pagos')
ORDER BY tablename;

-- 4. Test directo de INSERT en semanas (ejecutar como superuser/service_role en SQL Editor)
-- Si esto funciona aquí pero no desde la Edge Function → problema con la key
INSERT INTO semanas (numero, fecha_inicio, fecha_fin, bote_euros, estado)
VALUES (8888, '2025-01-01', '2025-01-07', 0, 'abierta')
ON CONFLICT DO NOTHING;

SELECT id, numero, estado FROM semanas WHERE numero = 8888;

-- Limpiar test
DELETE FROM semanas WHERE numero = 8888;
