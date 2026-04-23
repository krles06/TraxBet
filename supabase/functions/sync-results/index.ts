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

console.log("=== Iniciando función sync-results ===");
console.log("URL:", SUPABASE_URL ? `OK (${SUPABASE_URL})` : "FALTA ❌");
console.log("SERVICE_KEY presente:", SERVICE_ROLE_KEY ? "OK" : "FALTA ❌");
console.log("SERVICE_KEY formato:", SERVICE_ROLE_KEY?.startsWith('eyJ') ? "JWT legacy ✅" : SERVICE_ROLE_KEY?.startsWith('sb_') ? "Nueva key sb_... ⚠️ puede no funcionar" : "Desconocido ❓");
console.log("API_KEY:", FOOTBALL_API_KEY ? "OK" : "FALTA ❌");

const supabase = createClient(
  SUPABASE_URL || '',
  SERVICE_ROLE_KEY || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    }
  }
)

// Helper para loguear errores de Supabase de forma legible
function logError(context: string, error: any) {
  console.error(`❌ ERROR en ${context}:`, JSON.stringify({
    message: error?.message,
    code: error?.code,
    details: error?.details,
    hint: error?.hint,
  }))
}

export default async (req: Request) => {
  try {
    const body = await req.json().catch(() => ({}))
    const action = body.action || 'sync'
    console.log("Acción recibida:", action);

    // Test de conectividad mínimo antes de hacer nada
    const { data: testData, error: testError } = await supabase
      .from('semanas')
      .select('count')
      .limit(1)

    if (testError) {
      logError('test de conectividad SELECT semanas', testError)
      return new Response(JSON.stringify({
        error: 'DB no accesible',
        details: testError
      }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    }
    console.log("✅ Conectividad DB OK, semanas SELECT funciona");

    if (action === 'sync') {
      await syncResults()
    } else if (action === 'sync_upcoming') {
      console.log("Sincronizando próximos partidos...");
      await syncUpcomingMatches()
    } else if (action === 'test_write') {
      // Acción de diagnóstico: solo prueba un INSERT en semanas
      await testWrite()
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error("❌ ERROR CRÍTICO:", err.message, err.stack);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ============================================
// TEST DE ESCRITURA (DIAGNÓSTICO)
// ============================================
async function testWrite() {
  console.log("--- Test de escritura en semanas ---")

  const testData = {
    numero: 9999,
    fecha_inicio: '2025-01-01',
    fecha_fin: '2025-01-07',
    bote_euros: 0,
    estado: 'abierta' as const,
  }

  const { data, error } = await supabase
    .from('semanas')
    .upsert(testData, { onConflict: 'numero' })
    .select('id, numero')

  if (error) {
    logError('test INSERT semanas', error)
    console.error("El INSERT falló. Causas probables:",
      "1) Key incorrecta (anon en vez de service_role)",
      "2) RLS bloquea sin políticas de INSERT",
      "3) URL del proyecto equivocada"
    )
  } else {
    console.log("✅ INSERT en semanas OK:", JSON.stringify(data))
  }
}

// ============================================
// SINCRONIZAR RESULTADOS DE PARTIDOS RECIENTES
// ============================================
async function syncResults() {
  console.log("--- syncResults iniciado ---")
  const res = await fetch(
    `https://api.football-data.org/v4/competitions/${LALIGA_ID}/matches?status=FINISHED`,
    { headers: { 'X-Auth-Token': FOOTBALL_API_KEY } }
  )

  if (!res.ok) {
    console.error(`❌ Football API error: ${res.status} ${res.statusText}`)
    return
  }

  const data = await res.json()
  const matches = (data.matches || []).filter(
    (m: any) => m.homeTeam.id === BARCA_ID || m.awayTeam.id === BARCA_ID ||
         m.homeTeam.id === MADRID_ID || m.awayTeam.id === MADRID_ID
  )
  console.log(`Partidos encontrados en API: ${matches.length}`)

  for (const match of matches) {
    const { data: existing, error: selectError } = await supabase
      .from('partidos')
      .select('id, estado, semana_id')
      .eq('external_id', match.id)
      .single()

    if (selectError && selectError.code !== 'PGRST116') {
      logError(`SELECT partido ${match.id}`, selectError)
      continue
    }

    if (!existing) continue

    if (existing.estado !== 'finalizado') {
      const { error: updateError } = await supabase.from('partidos').update({
        estado: 'finalizado',
        goles_local: match.score.fullTime.home,
        goles_visitante: match.score.fullTime.away,
        updated_at: new Date().toISOString(),
      }).eq('external_id', match.id)

      if (updateError) {
        logError(`UPDATE partido ${match.id}`, updateError)
      } else {
        console.log(`✅ Partido ${match.id} actualizado: ${match.score.fullTime.home}-${match.score.fullTime.away}`)
      }

      if (existing.semana_id) {
        await checkWinner(existing.semana_id)
      }
    }
  }
  console.log("--- syncResults completado ---")
}

// ============================================
// SINCRONIZAR PRÓXIMOS PARTIDOS
// ============================================
async function syncUpcomingMatches() {
  console.log("--- syncUpcomingMatches iniciado ---")
  const today = new Date()
  const in21days = new Date(today.getTime() + 21 * 24 * 60 * 60 * 1000)
  const dateFrom = today.toISOString().split('T')[0]
  const dateTo = in21days.toISOString().split('T')[0]

  const res = await fetch(
    `https://api.football-data.org/v4/competitions/${LALIGA_ID}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}&status=SCHEDULED`,
    { headers: { 'X-Auth-Token': FOOTBALL_API_KEY } }
  )

  if (!res.ok) {
    console.error(`❌ Football API error: ${res.status} ${res.statusText}`)
    return
  }

  const data = await res.json()
  const matches = (data.matches || []).filter(
    (m: any) => m.homeTeam.id === BARCA_ID || m.awayTeam.id === BARCA_ID ||
         m.homeTeam.id === MADRID_ID || m.awayTeam.id === MADRID_ID
  )
  console.log(`Próximos partidos relevantes: ${matches.length}`)

  const currentWeekId = await getOrCreateCurrentWeek()
  if (!currentWeekId) {
    console.error("❌ No se pudo obtener/crear semana actual, abortando")
    return
  }
  console.log("Semana actual ID:", currentWeekId)

  for (const match of matches) {
    const { data: existing, error: selectError } = await supabase
      .from('partidos')
      .select('id')
      .eq('external_id', match.id)
      .single()

    if (selectError && selectError.code !== 'PGRST116') {
      logError(`SELECT partido ${match.id}`, selectError)
      continue
    }

    if (!existing) {
      const { error: insertError } = await supabase.from('partidos').insert({
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

      if (insertError) {
        logError(`INSERT partido ${match.id}`, insertError)
      } else {
        console.log(`✅ Partido insertado: ${match.id} (${match.homeTeam.shortName || match.homeTeam.name} vs ${match.awayTeam.shortName || match.awayTeam.name})`)
      }
    }
  }
  console.log("--- syncUpcomingMatches completado ---")
}

// ============================================
// VERIFICAR GANADOR DE UNA SEMANA
// ============================================
async function checkWinner(semanaId: string) {
  const { data: partidos, error: selectError } = await supabase
    .from('partidos')
    .select('id, estado')
    .eq('semana_id', semanaId)

  if (selectError) {
    logError('checkWinner SELECT partidos', selectError)
    return
  }

  const todosTerminados = partidos?.every((p: any) => p.estado === 'finalizado')
  if (!todosTerminados) return

  const { data: ganadores, error: rpcError } = await supabase.rpc('verificar_ganadores', {
    p_semana_id: semanaId
  })

  if (rpcError) {
    logError('verificar_ganadores RPC', rpcError)
    return
  }

  const { data: semana, error: semanaError } = await supabase
    .from('semanas')
    .select('*')
    .eq('id', semanaId)
    .single()

  if (semanaError) {
    logError('SELECT semana en checkWinner', semanaError)
    return
  }

  if (ganadores && ganadores.length > 0) {
    const ganador = ganadores[0]
    const { error: updateError } = await supabase.from('semanas').update({
      estado: 'resuelta',
      ganador_id: ganador.ganador_id,
    }).eq('id', semanaId)

    if (updateError) logError('UPDATE semana ganador', updateError)
    else console.log(`✅ Ganador semana ${semanaId}: ${ganador.username}`)
  } else {
    const { error: updateError } = await supabase.from('semanas').update({ estado: 'resuelta' }).eq('id', semanaId)
    if (updateError) logError('UPDATE semana sin ganador', updateError)

    await rolloverBote(semanaId, semana.bote_euros)
  }
}

// ============================================
// BOTE SE ACUMULA A SIGUIENTE SEMANA
// ============================================
async function rolloverBote(semanaId: string, boteActual: number) {
  const nextWeekId = await getOrCreateCurrentWeek()
  if (!nextWeekId || nextWeekId === semanaId) return

  const { data: nextWeek, error: selectError } = await supabase
    .from('semanas')
    .select('bote_euros')
    .eq('id', nextWeekId)
    .single()

  if (selectError) {
    logError('SELECT semana siguiente en rolloverBote', selectError)
    return
  }

  const { error: updateError } = await supabase.from('semanas').update({
    bote_euros: (nextWeek?.bote_euros || 0) + boteActual
  }).eq('id', nextWeekId)

  if (updateError) logError('UPDATE rolloverBote', updateError)
  else console.log(`✅ Bote ${boteActual}€ acumulado a semana ${nextWeekId}`)
}

// ============================================
// OBTENER O CREAR SEMANA ACTUAL
// ============================================
async function getOrCreateCurrentWeek(): Promise<string | null> {
  const today = new Date()

  const { data: existing, error: selectError } = await supabase
    .from('semanas')
    .select('id')
    .eq('estado', 'abierta')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (selectError && selectError.code !== 'PGRST116') {
    logError('SELECT semana abierta', selectError)
    return null
  }

  if (existing) {
    console.log("Semana abierta encontrada:", existing.id)
    return existing.id
  }

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

  const newNumero = (lastSemana?.numero || 0) + 1
  console.log(`Creando semana nueva: numero=${newNumero}`)

  const { data: newSemana, error: insertError } = await supabase
    .from('semanas')
    .insert({
      numero: newNumero,
      fecha_inicio: monday.toISOString().split('T')[0],
      fecha_fin: sunday.toISOString().split('T')[0],
      bote_euros: 0,
      estado: 'abierta',
    })
    .select('id')
    .single()

  if (insertError) {
    logError('INSERT nueva semana', insertError)
    return null
  }

  console.log("✅ Nueva semana creada:", newSemana.id)
  return newSemana.id
}
