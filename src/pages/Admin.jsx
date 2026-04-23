import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth.jsx'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const FOOTBALL_API_KEY = import.meta.env.VITE_FOOTBALL_API_KEY
const BARCA_ID = 81
const MADRID_ID = 86
const IS_DEV = import.meta.env.DEV

async function footballFetch(type) {
  let data
  if (IS_DEV) {
    // En desarrollo localhost está en el allowlist de CORS de football-data.org
    const today = new Date()
    let url
    if (type === 'upcoming') {
      const in21days = new Date(today.getTime() + 21 * 24 * 60 * 60 * 1000)
      url = `https://api.football-data.org/v4/competitions/PD/matches?dateFrom=${today.toISOString().split('T')[0]}&dateTo=${in21days.toISOString().split('T')[0]}&status=SCHEDULED`
    } else {
      url = `https://api.football-data.org/v4/competitions/PD/matches?status=FINISHED`
    }
    const res = await fetch(url, { headers: { 'X-Auth-Token': FOOTBALL_API_KEY } })
    if (!res.ok) throw new Error(`API error ${res.status}`)
    data = await res.json()
  } else {
    // En producción usamos el proxy serverless de Vercel para evitar CORS
    const res = await fetch(`/api/football?type=${type}`)
    if (!res.ok) throw new Error(`Proxy error ${res.status}`)
    data = await res.json()
  }
  return (data.matches || []).filter(
    m => m.homeTeam.id === BARCA_ID || m.awayTeam.id === BARCA_ID ||
         m.homeTeam.id === MADRID_ID || m.awayTeam.id === MADRID_ID
  )
}

async function fetchUpcomingMatches() {
  return footballFetch('upcoming')
}

async function fetchFinishedMatches() {
  return footballFetch('finished')
}


export default function Admin() {
  const { profile } = useAuth()
  const [semana, setSemana] = useState(null)
  const [partidos, setPartidos] = useState([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [boteInput, setBoteInput] = useState('5')
  const [msg, setMsg] = useState({ text: '', type: 'ok' })

  useEffect(() => {
    if (profile?.is_admin) loadData()
    else setLoading(false)
  }, [profile])

  async function loadData() {
    setLoading(true)
    const { data: sem } = await supabase
      .from('semanas')
      .select('*')
      .in('estado', ['abierta', 'cerrada'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setSemana(sem)
    if (sem) {
      setBoteInput(String(sem.bote_euros))
      const { data: parts } = await supabase
        .from('partidos')
        .select('*')
        .eq('semana_id', sem.id)
        .order('fecha_partido')
      setPartidos(parts || [])
    }
    setLoading(false)
  }

  function showMsg(text, type = 'ok') {
    setMsg({ text, type })
    setTimeout(() => setMsg({ text: '', type: 'ok' }), 5000)
  }

  async function crearSemana() {
    setWorking(true)
    try {
      const allMatches = await fetchUpcomingMatches()
      if (allMatches.length === 0) {
        showMsg('No hay partidos de Barça/Madrid programados en los próximos 21 días', 'warn')
        setWorking(false)
        return
      }

      // Solo la jornada más próxima (menor número de jornada entre los resultados)
      const jornadaMinima = Math.min(...allMatches.map(m => m.matchday).filter(Boolean))
      const matches = jornadaMinima
        ? allMatches.filter(m => m.matchday === jornadaMinima)
        : allMatches.slice(0, 2)

      const { data: lastSem } = await supabase
        .from('semanas').select('numero').order('numero', { ascending: false }).limit(1).maybeSingle()

      const today = new Date()
      const in14 = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000)
      const nextNumero = (lastSem?.numero || 0) + 1

      const { data: newSem, error } = await supabase
        .from('semanas')
        .insert({
          numero: nextNumero,
          fecha_inicio: today.toISOString().split('T')[0],
          fecha_fin: in14.toISOString().split('T')[0],
          bote_euros: parseFloat(boteInput) || 0,
          estado: 'abierta',
        })
        .select('id')
        .single()

      if (error) { showMsg('Error creando semana: ' + error.message, 'err'); setWorking(false); return }

      for (const m of matches) {
        await supabase.from('partidos').insert({
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

      const jornada = matches[0]?.matchday ? ` (jornada ${matches[0].matchday})` : ''
      showMsg(`✅ Semana ${nextNumero} creada con ${matches.length} partido(s)${jornada}`)
      await loadData()
    } catch (e) {
      showMsg('Error de API: ' + e.message, 'err')
    }
    setWorking(false)
  }

  async function sincronizarResultados() {
    setWorking(true)
    try {
      const finished = await fetchFinishedMatches()
      let updated = 0

      for (const m of finished) {
        const { data: partido } = await supabase
          .from('partidos').select('id, estado, semana_id').eq('external_id', m.id).maybeSingle()
        if (!partido || partido.estado === 'finalizado') continue

        await supabase.from('partidos').update({
          estado: 'finalizado',
          goles_local: m.score.fullTime.home,
          goles_visitante: m.score.fullTime.away,
          updated_at: new Date().toISOString(),
        }).eq('id', partido.id)
        updated++
      }

      // Si todos los partidos de la semana han terminado, calcular ganadores
      if (semana && updated > 0) {
        const { data: allParts } = await supabase
          .from('partidos').select('estado').eq('semana_id', semana.id)
        const reloadedParts = await supabase
          .from('partidos').select('estado').eq('semana_id', semana.id)
        const todosFin = (reloadedParts.data || []).every(p => p.estado === 'finalizado')

        if (todosFin) {
          const { data: ganadores } = await supabase.rpc('verificar_ganadores', { p_semana_id: semana.id })
          if (ganadores && ganadores.length > 0) {
            await supabase.from('semanas').update({ estado: 'resuelta', ganador_id: ganadores[0].ganador_id }).eq('id', semana.id)
            showMsg(`✅ ${updated} partido(s) actualizado(s). ¡Ganador: ${ganadores[0].username}!`)
          } else {
            await supabase.from('semanas').update({ estado: 'resuelta' }).eq('id', semana.id)
            showMsg(`✅ ${updated} partido(s) actualizado(s). Nadie acertó — el bote se acumula.`)
          }
        } else {
          showMsg(`✅ ${updated} partido(s) actualizado(s)`)
        }
      } else if (updated === 0) {
        showMsg('No hay resultados nuevos', 'warn')
      } else {
        showMsg(`✅ ${updated} partido(s) actualizado(s)`)
      }

      await loadData()
    } catch (e) {
      showMsg('Error: ' + e.message, 'err')
    }
    setWorking(false)
  }

  async function actualizarBote() {
    if (!semana) return
    setWorking(true)
    const { error } = await supabase
      .from('semanas').update({ bote_euros: parseFloat(boteInput) || 0 }).eq('id', semana.id)
    if (error) showMsg('Error: ' + error.message, 'err')
    else showMsg('✅ Bote actualizado')
    await loadData()
    setWorking(false)
  }

  async function cerrarSemana() {
    if (!semana) return
    setWorking(true)
    await supabase.from('semanas').update({ estado: 'cerrada' }).eq('id', semana.id)
    showMsg('🔒 Semana cerrada — ya no se aceptan predicciones')
    await loadData()
    setWorking(false)
  }

  if (!profile?.is_admin) return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '80px 16px', textAlign: 'center' }}>
      <p style={{ fontSize: '40px', marginBottom: '12px' }}>🔒</p>
      <p style={{ color: 'var(--text2)' }}>Solo administradores</p>
    </div>
  )

  if (loading) return null

  const msgColor = msg.type === 'err' ? 'var(--rojo)' : msg.type === 'warn' ? 'var(--amarillo)' : 'var(--verde)'
  const msgBg = msg.type === 'err' ? 'rgba(255,61,61,0.1)' : msg.type === 'warn' ? 'rgba(255,214,0,0.1)' : 'rgba(0,200,83,0.1)'

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '8px' }}>⚙️ Admin</h1>
      <p style={{ color: 'var(--text2)', fontSize: '13px', marginBottom: '24px' }}>Panel de administración de la porra</p>

      {msg.text && (
        <div style={{ padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', background: msgBg, color: msgColor, fontSize: '14px' }}>
          {msg.text}
        </div>
      )}

      {/* Sin semana activa */}
      {!semana && (
        <div className="card" style={{ marginBottom: '16px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '8px' }}>Nueva semana</h3>
          <p style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '16px' }}>
            Se cargarán automáticamente los próximos partidos de Barça y Madrid (21 días).
          </p>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text2)' }}>Bote inicial (€)</label>
            <input className="input" type="number" value={boteInput}
              onChange={e => setBoteInput(e.target.value)} min="0" step="1" />
          </div>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={crearSemana} disabled={working}>
            {working ? 'Cargando partidos...' : '➕ Nueva semana y cargar partidos'}
          </button>
        </div>
      )}

      {/* Semana activa o cerrada */}
      {semana && (
        <>
          <div className="card" style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '600' }}>Semana {semana.numero}</h3>
              <span className={`badge badge-${semana.estado === 'abierta' ? 'amarillo' : 'gris'}`}>
                {semana.estado === 'abierta' ? '🟢 Abierta' : '🔒 Cerrada'}
              </span>
            </div>

            {/* Bote */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text2)' }}>Bote (€)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input className="input" type="number" value={boteInput}
                  onChange={e => setBoteInput(e.target.value)} min="0" step="1" />
                <button className="btn btn-secondary" onClick={actualizarBote} disabled={working} style={{ flexShrink: 0 }}>
                  Guardar
                </button>
              </div>
            </div>

            {/* Acciones */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={sincronizarResultados} disabled={working}>
                🔄 Sync resultados
              </button>
              {semana.estado === 'abierta' && (
                <button className="btn btn-secondary"
                  style={{ flex: 1, color: 'var(--rojo)', borderColor: 'rgba(255,61,61,0.2)' }}
                  onClick={cerrarSemana} disabled={working}>
                  🔒 Cerrar semana
                </button>
              )}
            </div>
          </div>

          {/* Partidos */}
          <div className="card" style={{ marginBottom: '16px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px' }}>
              Partidos ({partidos.length})
            </h3>
            {partidos.length === 0 ? (
              <p style={{ color: 'var(--text2)', fontSize: '14px' }}>Sin partidos cargados</p>
            ) : partidos.map((p, i) => {
              const fecha = format(new Date(p.fecha_partido), "EEE d MMM, HH:mm", { locale: es })
              return (
                <div key={p.id} style={{
                  padding: '12px 0',
                  borderBottom: i < partidos.length - 1 ? '1px solid var(--border)' : 'none',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: '600', marginBottom: '2px' }}>
                      {p.es_barca ? '🔵🔴' : '⚪'} {p.equipo_local} vs {p.equipo_visitante}
                    </p>
                    <p style={{ fontSize: '12px', color: 'var(--text2)' }}>{fecha}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {p.estado === 'finalizado' ? (
                      <span style={{ fontFamily: 'var(--mono)', fontWeight: '700', color: 'var(--verde)' }}>
                        {p.goles_local} - {p.goles_visitante}
                      </span>
                    ) : (
                      <span className="badge badge-amarillo">Pendiente</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Nueva semana (si la actual está cerrada) */}
          {semana.estado === 'cerrada' && (
            <div className="card">
              <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '8px' }}>Siguiente semana</h3>
              <p style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '16px' }}>
                La semana actual está cerrada. Crea la siguiente.
              </p>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text2)' }}>Bote (€)</label>
                <input className="input" type="number" value={boteInput}
                  onChange={e => setBoteInput(e.target.value)} min="0" step="1" />
              </div>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={crearSemana} disabled={working}>
                {working ? 'Cargando...' : '➕ Nueva semana y cargar partidos'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
