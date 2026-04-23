# ⚽ Porra Fútbol — Barça & Madrid

App web para gestionar la porra semanal de fútbol: predicciones de resultados de Barça y Real Madrid en La Liga, bote acumulado, ranking, y notificaciones por WhatsApp.

---

## Stack técnico

| Capa | Tecnología | Coste |
|------|-----------|-------|
| Frontend | React + Vite | Gratis |
| Hosting | Vercel | Gratis |
| Base de datos + Auth | Supabase | Gratis (hasta 500MB) |
| API partidos | football-data.org | Gratis (10 req/min) |
| WhatsApp | Twilio | *(No implementado de momento)* |

---

## 🚀 Guía de instalación paso a paso

### 1. football-data.org (API de fútbol)

1. Ve a https://www.football-data.org/client/register
2. Crea una cuenta gratuita
3. Copia tu **API Key** del dashboard
4. Guárdala, la necesitas más adelante

### 2. Supabase (base de datos)

1. Ve a https://supabase.com y crea un proyecto nuevo
2. Nombre del proyecto: `porra-futbol`
3. Guarda la contraseña de la base de datos
4. Una vez creado, ve a **Settings > API** y copia:
   - `Project URL` → esto es tu `SUPABASE_URL`
   - `anon public key` → esto es tu `SUPABASE_ANON_KEY`
   - `service_role secret key` → para las Edge Functions

5. **Crear las tablas**: Ve a **SQL Editor** en el panel de Supabase y ejecuta el contenido completo del archivo:
   ```
   supabase/migrations/001_schema.sql
   ```

### 3. Configurar la app

```bash
# Clonar/descargar el proyecto
cd porra-futbol

# Instalar dependencias
npm install

# Copiar variables de entorno
cp .env.example .env

# Editar .env con tus valores reales:
# VITE_SUPABASE_URL=https://TUPROYECTO.supabase.co
# VITE_SUPABASE_ANON_KEY=tu_key_aqui
# VITE_FOOTBALL_API_KEY=tu_key_de_football_data
```

### 4. Probar en local

```bash
npm run dev
# Abre http://localhost:5173
```

### 5. Deploy en Vercel

1. Sube el proyecto a GitHub
2. Ve a https://vercel.com, importa el repositorio
3. En **Settings > Environment Variables**, añade:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_FOOTBALL_API_KEY`
4. Click en **Deploy**
5. Copia la URL de tu app (ej: `https://porra-futbol.vercel.app`)

---

## 🤖 Configurar la Edge Function (cron automático)

Esta función sincroniza resultados automáticamente y envía WhatsApps.

### En Supabase Dashboard:

1. Ve a **Edge Functions** > **Deploy new function**
2. Nombre: `sync-results`
3. Sube el archivo `supabase/functions/sync-results/index.ts`

4. Ve a **Settings > Secrets** y añade estas variables:
   ```
   FOOTBALL_API_KEY=tu_key
   SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
   APP_URL=https://tu-app.vercel.app
   ```

5. **Configurar el cron**: Ve a **Edge Functions > Schedules** y crea:
   - Sync resultados: `0 23 * * *` (cada noche a las 23h)
   - Sync próximos partidos: `0 8 * * 1` (lunes a las 8am)

   Para sincronizar próximos partidos manualmente llama a la función con el body: `{"action": "sync_upcoming"}`.

---

## 📱 Configurar Twilio WhatsApp (NO IMPLEMENTADO DE MOMENTO)

*(La integración con WhatsApp ha sido temporalmente desactivada. Esta sección queda como referencia para el futuro).*

### Sandbox (GRATIS para probar):

1. Crea cuenta en https://www.twilio.com
2. Ve a **Messaging > Try it out > Send a WhatsApp message**
3. Tus compañeros deben enviar el mensaje del sandbox al número indicado para activarse
4. El número del sandbox es: `whatsapp:+14155238886`

### Producción (de pago, ~0.005€/msg):
1. En Twilio, ve a **Messaging > Senders > WhatsApp Senders**
2. Solicita un número propio (proceso de aprobación ~1 semana)
3. Actualiza `TWILIO_WHATSAPP_FROM` con tu número

---

## 📋 Flujo de uso semanal

```
Lunes 9:00  → Cada usuario abre la app y pone su resultado

Antes del partido → App cierra las predicciones automáticamente

Durante/después del partido → Edge Function sincroniza resultado

Resultado final → Sistema verifica automáticamente quién acertó
```

---

## 🛠️ Administración

Para crear una nueva semana manualmente, ejecuta en el SQL Editor de Supabase:

```sql
INSERT INTO semanas (numero, fecha_inicio, fecha_fin, bote_euros, estado)
VALUES (1, '2024-09-02', '2024-09-08', 40, 'abierta');
-- Ajusta el número de semana, fechas y bote inicial
```

Para añadir partidos manualmente (si la API no los carga):

```sql
INSERT INTO partidos (external_id, semana_id, equipo_local, equipo_visitante, 
  equipo_local_id, equipo_visitante_id, fecha_partido, es_barca, jornada)
VALUES (
  999001, -- ID único
  'UUID_DE_TU_SEMANA',
  'FC Barcelona', 'Atlético de Madrid',
  81, 207,
  '2024-09-15 16:00:00+00',
  true, 5
);
```

---

## 💡 Mejoras futuras ideas

- Panel admin web para crear semanas y gestionar pagos
- Modo "liga interna" con ranking de temporada
- Estadísticas por jugador (partidos acertados histórico)
- Soporte para más competiciones (Copa del Rey, Champions)
- PWA para instalar en el móvil como app nativa
