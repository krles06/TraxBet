// Vercel Cron Job — se ejecuta cada hora
// Sincroniza resultados de partidos y crea la siguiente semana automáticamente
// Requiere en Vercel: SUPABASE_SERVICE_ROLE_KEY y CRON_SECRET

import { createClient } from '@supabase/supabase-js'

const BARCA_ID = 81
const MADRID_ID = 86
const FOOTBALL_API_KEY = process.env.VITE_FOOTBALL_API_KEY
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function getAdminClient() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false }
  })
}

export default async function handler(req, res) {
  // Vercel inyecta CRON_SECRET automáticamente en los cron jobs
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const db = getAdminClient()
  const log = []

  try {
    // ── 1. SINCRONIZAR RESULTADOS ──────────────────────────────────────────
    const { data: semana } = await db
      .from('semanas').select('*')
      .in('estado', ['abierta', 'cerrada'])
      .order('created_at', { ascending: false })
      .limit(1).maybeSingle()

    if (semana) {
      const { data: partidos } = await db
        .from('partidos').select('*')
        .eq('semana_id', semana.id)
        .neq('estado', 'finalizado')

      if (partidos && partidos.length > 0) {
        // Traer partidos finalizados de la API
        const res2 = await fetch(
          'https://api.football-data.org/v4/competitions/PD/matches?status=FINISHED',
          { headers: { 'X-Auth-Token': FOOTBALL_API_KEY } }
        )
        const apiData = await res2.json()
        const finalizados = (apiData.matches || []).filter(
          m => m.homeTeam.id === BARCA_ID || m.awayTeam.id === BARCA_ID ||
               m.homeTeam.id === MADRID_ID || m.awayTeam.id === MADRID_ID
        )

        let actualizados = 0
        for (const m of finalizados) {
          const partido = partidos.find(p => p.external_id === m.id)
          if (!partido) continue

          await db.from('partidos').update({
            estado: 'finalizado',
            goles_local: m.score.fullTime.home,
            goles_visitante: m.score.fullTime.away,
            updated_at: new Date().toISOString(),
          }).eq('id', partido.id)
          actualizados++
        }
        if (actualizados > 0) log.push(`${actualizados} partido(s) actualizados`)
      }

      // ── 2. VERIFICAR SI LA SEMANA ESTÁ RESUELTA ───────────────────────
      const { data: todosPartidos } = await db
        .from('partidos').select('estado').eq('semana_id', semana.id)

      const todosTerminados = todosPartidos?.length > 0 &&
        todosPartidos.every(p => p.estado === 'finalizado')

      if (todosTerminados) {
        const { data: ganadores } = await db.rpc('verificar_ganadores', {
          p_semana_id: semana.id
        })

        if (ganadores && ganadores.length > 0) {
          await db.from('semanas').update({
            estado: 'resuelta',
            ganador_id: ganadores[0].ganador_id,
          }).eq('id', semana.id)
          log.push(`Semana ${semana.numero} resuelta — ganador: ${ganadores[0].username}`)
        } else {
          await db.from('semanas').update({ estado: 'resuelta' }).eq('id', semana.id)
          log.push(`Semana ${semana.numero} resuelta — nadie acertó, bote acumulado`)
        }
      }
    }

    // ── 3. CREAR NUEVA SEMANA SI NO HAY NINGUNA ACTIVA ────────────────────
    const { data: semanaActiva } = await db
      .from('semanas').select('id').eq('estado', 'abierta').limit(1).maybeSingle()

    if (!semanaActiva) {
      // Calcular bote: si la última semana no tuvo ganador, acumular
      const { data: ultimaSemana } = await db
        .from('semanas').select('bote_euros, ganador_id')
        .eq('estado', 'resuelta')
        .order('created_at', { ascending: false })
        .limit(1).maybeSingle()

      const boteAcumulado = ultimaSemana && !ultimaSemana.ganador_id
        ? Number(ultimaSemana.bote_euros)
        : 0

      // Obtener próximos partidos de la jornada más cercana
      const today = new Date()
      const in21days = new Date(today.getTime() + 21 * 24 * 60 * 60 * 1000)
      const apiRes = await fetch(
        `https://api.football-data.org/v4/competitions/PD/matches?dateFrom=${today.toISOString().split('T')[0]}&dateTo=${in21days.toISOString().split('T')[0]}&status=SCHEDULED`,
        { headers: { 'X-Auth-Token': FOOTBALL_API_KEY } }
      )
      const apiData = await apiRes.json()
      const barcaMadrid = (apiData.matches || []).filter(
        m => m.homeTeam.id === BARCA_ID || m.awayTeam.id === BARCA_ID ||
             m.homeTeam.id === MADRID_ID || m.awayTeam.id === MADRID_ID
      )

      if (barcaMadrid.length > 0) {
        const jornadaMinima = Math.min(...barcaMadrid.map(m => m.matchday).filter(Boolean))
        const matches = jornadaMinima
          ? barcaMadrid.filter(m => m.matchday === jornadaMinima)
          : barcaMadrid.slice(0, 2)

        const { data: lastSem } = await db
          .from('semanas').select('numero')
          .order('numero', { ascending: false }).limit(1).maybeSingle()

        const in14 = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000)
        const { data: newSem } = await db.from('semanas').insert({
          numero: (lastSem?.numero || 0) + 1,
          fecha_inicio: today.toISOString().split('T')[0],
          fecha_fin: in14.toISOString().split('T')[0],
          bote_euros: boteAcumulado,
          estado: 'abierta',
        }).select('id').single()

        for (const m of matches) {
          await db.from('partidos').insert({
            external_id: m.id,
            semana_id: newSem.id,
            equipo_local: m.homeTeam.shortName || m.homeTeam.name,
            equipo_visitante: m.awayTeam.shortName || m.awayTeam.name,
            equipo_local_id: m.homeTeam.id,
            equipo_visitante_id: m.awayTeam.id,
            fecha_partido: m.utcDate,
            estado: 'programado',
            es_barca: m.homeTeam.id === BARCA_ID || m.awayTeam.id === BARCA_ID,
            es_madrid: m.homeTeam.id === MADRID_ID || m.awayTeam.id === MADRID_ID,
            jornada: m.matchday,
          })
        }
        log.push(`Semana ${(lastSem?.numero || 0) + 1} creada automáticamente con ${matches.length} partido(s) (jornada ${jornadaMinima})`)
      }
    }

    return res.status(200).json({ ok: true, log, timestamp: new Date().toISOString() })
  } catch (err) {
    return res.status(500).json({ error: err.message, log })
  }
}
