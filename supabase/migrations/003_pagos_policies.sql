-- Permitir a todos los usuarios autenticados ver los pagos (para la vista de participantes)
CREATE POLICY "Pagos: lectura pública autenticada" ON pagos
  FOR SELECT TO authenticated USING (true);

-- Permitir al admin insertar pagos manualmente
CREATE POLICY "Admin puede insertar pagos" ON pagos
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Permitir al admin actualizar pagos (aprobar/rechazar)
CREATE POLICY "Admin puede actualizar pagos" ON pagos
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Permitir al usuario insertar su propio pago (cuando guarda una predicción)
CREATE POLICY "Usuario puede crear su propio pago" ON pagos
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
