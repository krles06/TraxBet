// Supabase Edge Function: sync-results
// Se ejecuta via cron job diariamente
// Configurar en Supabase Dashboard > Edge Functions > Schedules: "0 22 * * *" (22:00 cada día)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const FOOTBALL_API_KEY = Deno.env.get('FOOTBALL_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const BARCA_ID = 81
const MADRID_ID = 86
const LALIGA_ID = 'PD'

console.log("Iniciando función...");
console.log("URL:", SUPABASE_URL ? "OK" : "FALTA");
console.log("SERVICE_KEY:", SERVICE_ROLE_KEY ? "OK" : "FALTA");
console.log("API_KEY:", FOOTBALL_API_KEY ? "OK" : "FALTA");

const supabase = createClient(
  SUPABASE_URL || '',
  SERVICE_ROLE_KEY || ''
)

export default async (req: Request) => {
  try {
    const { action } = await req.json().catch(() => ({ action: 'sync' }))
    console.log("Acción recibida:", action);

    if (action === 'sync') {
      await syncResults()
    } else if (action === 'sync_upcoming') {
      console.log("Sincronizando próximos partidos...");
      await syncUpcomingMatches()
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error("ERROR CRÍTICO:", err.message);
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ============================================
// SINCRONIZAR RESULTADOS DE PARTIDOS RECIENTES
// ============================================
async function syncResults() {
  const res = await fetch(
    `https://api.football-data.org/v4/competitions/${LALIGA_ID}/matches?status=FINISHED`,
    { headers: { 'X-Auth-Token': FOOTBALL_API_KEY } }
  )
  const data = await res.json()
  const matches = (data.matches || []).filter(
    m => m.homeTeam.id === BARCA_ID || m.awayTeam.id === BARCA_ID ||
         m.homeTeam.id === MADRID_ID || m.awayTeam.id === MADRID_ID
  )

  // Actualizar partidos en BD
  for (const match of matches) {
    const { data: existing } = await supabase
      .from('partidos')
      .select('id, estado, semana_id')
      .eq('external_id', match.id)
      .single()

    if (!existing) continue

    // Solo actualizar si no estaba ya finalizado
    if (existing.estado !== 'finalizado') {
      await supabase.from('partidos').update({
        estado: 'finalizado',
        goles_local: match.score.fullTime.home,
        goles_visitante: match.score.fullTime.away,
        updated_at: new Date().toISOString(),
      }).eq('external_id', match.id)

      console.log(`Partido ${match.id} actualizado: ${match.score.fullTime.home}-${match.score.fullTime.away}`)

      // Verificar si hay ganadores en la semana de este partido
      if (existing.semana_id) {
        await checkWinner(existing.semana_id)
      }
    }
  }
}

// ============================================
// SINCRONIZAR PRÓXIMOS PARTIDOS
// ============================================
async function syncUpcomingMatches() {
  const today = new Date()
  const in21days = new Date(today.getTime() + 21 * 24 * 60 * 60 * 1000)
  const dateFrom = today.toISOString().split('T')[0]
  const dateTo = in21days.toISOString().split('T')[0]

  const res = await fetch(
    `https://api.football-data.org/v4/competitions/${LALIGA_ID}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}&status=SCHEDULED`,
    { headers: { 'X-Auth-Token': FOOTBALL_API_KEY } }
  )
  const data = await res.json()
  const matches = (data.matches || []).filter(
    m => m.homeTeam.id === BARCA_ID || m.awayTeam.id === BARCA_ID ||
         m.homeTeam.id === MADRID_ID || m.awayTeam.id === MADRID_ID
  )

  // Obtener o crear semana actual
  const currentWeekId = await getOrCreateCurrentWeek()

  for (const match of matches) {
    const { data: existing } = await supabase
      .from('partidos')
      .select('id')
      .eq('external_id', match.id)
      .single()

    if (!existing) {
      await supabase.from('partidos').insert({
        external_id: match.id,
        semana_id: currentWeekId,
        equipo_local: match.homeTeam.shortName || match.homeTeam.name,
        equipo_visitante: match.awayTeam.shortName || match.awayTeam.name,
        equipo_local_id: match.homeTeam.id,
        equipo_visitante_id: match.awayTeam.id,
        fecha_partido: match.utcDate,
        estado: 'programado',
        es_barca: match.homeTeam.id === BARCA_ID || match.awayTeam.id === BARCA_ID,
        es_madrid: match.homeTeam.id === MADRID_ID || match.awayTeam.id === MADRID_ID,
        jornada: match.matchday,
      })
    }
  }
}

// ============================================
// VERIFICAR GANADOR DE UNA SEMANA
// ============================================
async function checkWinner(semanaId) {
  // Comprobar si todos los partidos de la semana han terminado
  const { data: partidos } = await supabase
    .from('partidos')
    .select('id, estado')
    .eq('semana_id', semanaId)

  const todosTerminados = partidos?.every(p => p.estado === 'finalizado')
  if (!todosTerminados) return

  // Llamar función SQL para verificar ganadores
  const { data: ganadores } = await supabase.rpc('verificar_ganadores', {
    p_semana_id: semanaId
  })

  const { data: semana } = await supabase
    .from('semanas')
    .select('*')
    .eq('id', semanaId)
    .single()

  if (ganadores && ganadores.length > 0) {
    // ¡Hay ganador!
    const ganador = ganadores[0]
    await supabase.from('semanas').update({
      estado: 'resuelta',
      ganador_id: ganador.ganador_id,
    }).eq('id', semanaId)
  } else {
    // Nadie acertó, acumular bote para siguiente semana
    await supabase.from('semanas').update({ estado: 'resuelta' }).eq('id', semanaId)
    await rolloverBote(semanaId, semana.bote_euros)
  }
}

// ============================================
// BOTE SE ACUMULA A SIGUIENTE SEMANA
// ============================================
async function rolloverBote(semanaId, boteActual) {
  // Obtener o crear la siguiente semana
  const nextWeekId = await getOrCreateCurrentWeek()
  if (nextWeekId === semanaId) return

  const { data: nextWeek } = await supabase
    .from('semanas')
    .select('bote_euros')
    .eq('id', nextWeekId)
    .single()

  await supabase.from('semanas').update({
    bote_euros: (nextWeek?.bote_euros || 0) + boteActual
  }).eq('id', nextWeekId)
}

// ============================================
// OBTENER O CREAR SEMANA ACTUAL
// ============================================
async function getOrCreateCurrentWeek() {
  const today = new Date()
  const { data: existing } = await supabase
    .from('semanas')
    .select('id')
    .eq('estado', 'abierta')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (existing) return existing.id

  // Crear nueva semana
  const monday = new Date(today)
  monday.setDate(today.getDate() - today.getDay() + 1)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  const { data: lastSemana } = await supabase
    .from('semanas')
    .select('numero')
    .order('numero', { ascending: false })
    .limit(1)
    .single()

  const { data: newSemana } = await supabase
    .from('semanas')
    .insert({
      numero: (lastSemana?.numero || 0) + 1,
      fecha_inicio: monday.toISOString().split('T')[0],
      fecha_fin: sunday.toISOString().split('T')[0],
      bote_euros: 0,
      estado: 'abierta',
    })
    .select('id')
    .single()

  return newSemana.id
}


