-- ============================================
-- PORRA FÚTBOL - Esquema de base de datos
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- Tabla de perfiles de usuario
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  phone TEXT,                  -- Para notificaciones WhatsApp
  whatsapp_opt_in BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de semanas/jornadas de la porra
CREATE TABLE IF NOT EXISTS semanas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  numero INTEGER NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  bote_euros DECIMAL(10,2) DEFAULT 0,
  estado TEXT DEFAULT 'abierta' CHECK (estado IN ('abierta', 'cerrada', 'resuelta')),
  ganador_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de partidos (sincronizada desde football-data.org)
CREATE TABLE IF NOT EXISTS partidos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id INTEGER UNIQUE NOT NULL,   -- ID de football-data.org
  semana_id UUID REFERENCES semanas(id),
  equipo_local TEXT NOT NULL,
  equipo_visitante TEXT NOT NULL,
  equipo_local_id INTEGER NOT NULL,      -- 81 = Barça, 86 = Madrid
  equipo_visitante_id INTEGER NOT NULL,
  fecha_partido TIMESTAMPTZ NOT NULL,
  estado TEXT DEFAULT 'programado' CHECK (estado IN ('programado', 'en_juego', 'finalizado', 'aplazado')),
  goles_local INTEGER,
  goles_visitante INTEGER,
  es_barca BOOLEAN DEFAULT false,
  es_madrid BOOLEAN DEFAULT false,
  jornada INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de predicciones
CREATE TABLE IF NOT EXISTS predicciones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  semana_id UUID REFERENCES semanas(id) ON DELETE CASCADE NOT NULL,
  partido_id UUID REFERENCES partidos(id) ON DELETE CASCADE NOT NULL,
  goles_local_prediccion INTEGER NOT NULL CHECK (goles_local_prediccion >= 0 AND goles_local_prediccion <= 20),
  goles_visitante_prediccion INTEGER NOT NULL CHECK (goles_visitante_prediccion >= 0 AND goles_visitante_prediccion <= 20),
  es_correcto BOOLEAN,                   -- null hasta que finalice el partido
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, partido_id)            -- Una predicción por partido por usuario
);

-- Tabla de pagos de la porra
CREATE TABLE IF NOT EXISTS pagos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  semana_id UUID REFERENCES semanas(id) ON DELETE CASCADE NOT NULL,
  importe DECIMAL(10,2) DEFAULT 5.00,
  pagado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, semana_id)
);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE semanas ENABLE ROW LEVEL SECURITY;
ALTER TABLE partidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE predicciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;

-- Profiles: cada usuario ve su propio perfil, todos pueden ver los nombres
CREATE POLICY "Profiles públicos para lectura" ON profiles FOR SELECT USING (true);
CREATE POLICY "Usuarios editan su propio perfil" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Semanas: todos pueden ver
CREATE POLICY "Semanas visibles para todos" ON semanas FOR SELECT USING (true);

-- Partidos: todos pueden ver
CREATE POLICY "Partidos visibles para todos" ON partidos FOR SELECT USING (true);

-- Predicciones: puedes ver todas DESPUÉS del partido, solo las tuyas antes
CREATE POLICY "Ver predicciones propias" ON predicciones FOR SELECT 
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM partidos p 
      WHERE p.id = partido_id AND p.estado = 'finalizado'
    )
  );
CREATE POLICY "Insertar predicciones propias" ON predicciones FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Actualizar predicciones propias" ON predicciones FOR UPDATE USING (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM partidos p 
    WHERE p.id = partido_id AND p.estado = 'programado'
  )
);

-- Pagos: solo ver los propios
CREATE POLICY "Ver pagos propios" ON pagos FOR SELECT USING (user_id = auth.uid());

-- ============================================
-- FUNCIÓN: crear perfil automáticamente al registrarse
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- FUNCIÓN: verificar ganadores de una semana
-- ============================================
CREATE OR REPLACE FUNCTION verificar_ganadores(p_semana_id UUID)
RETURNS TABLE(ganador_id UUID, username TEXT, acertados INTEGER) AS $$
BEGIN
  -- Primero actualizar si las predicciones son correctas
  UPDATE predicciones pred
  SET es_correcto = (
    pred.goles_local_prediccion = p.goles_local AND
    pred.goles_visitante_prediccion = p.goles_visitante
  )
  FROM partidos p
  WHERE pred.partido_id = p.id
    AND p.estado = 'finalizado'
    AND pred.semana_id = p_semana_id;

  -- Devolver usuarios que acertaron todos los partidos de la semana
  RETURN QUERY
  SELECT 
    pr.id,
    pr.username,
    COUNT(pred.id)::INTEGER as acertados
  FROM profiles pr
  JOIN predicciones pred ON pred.user_id = pr.id
  WHERE pred.semana_id = p_semana_id
    AND pred.es_correcto = true
  GROUP BY pr.id, pr.username
  HAVING COUNT(pred.id) = (
    SELECT COUNT(*) FROM partidos 
    WHERE semana_id = p_semana_id AND estado = 'finalizado'
  )
  ORDER BY acertados DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
