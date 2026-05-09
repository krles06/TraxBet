import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth.jsx'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Settings, Plus, RefreshCw, Lock, Circle, Check, X, AlertCircle, AlertTriangle, Wallet, Users, Search, ChevronRight } from 'lucide-react'

const FOOTBALL_API_KEY = import.meta.env.VITE_FOOTBALL_API_KEY
const BARCA_ID = 81
const MADRID_ID = 86
const IS_DEV = import.meta.env.DEV
const UPCOMING = ['SCHEDULED', 'TIMED', 'POSTPONED']

async function footballFetch(type) {
  let data
  if (IS_DEV) {
    const today = new Date()
    let url
    if (type === 'upcoming') {
      const in21days = new Date(today.getTime() + 21 * 24 * 60 * 60 * 1000)
      url = `https://api.football-data.org/v4/competitions/PD/matches?dateFrom=${today.toISOString().split('T')[0]}&dateTo=${in21days.toISOString().split('T')[0]}`
    } else {
      url = `https://api.football-data.org/v4/competitions/PD/matches?status=FINISHED`
    }
    const res = await fetch(url, { headers: { 'X-Auth-Token': FOOTBALL_API_KEY } })
    if (!res.ok) throw new Error(`API error ${res.status}`)
    data = await res.json()
  } else {
    const res = await fetch(`/api/football?type=${type}`)
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || `Proxy error ${res.status}`)
    data = json
  }
  return (data.matches || []).filter(
    m => (m.homeTeam.id === BARCA_ID || m.awayTeam.id === BARCA_ID ||
          m.homeTeam.id === MADRID_ID || m.awayTeam.id === MADRID_ID) &&
         (type === 'finished' || UPCOMING.includes(m.status))
  )
}

async function fetchFinishedMatches() { return footballFetch('finished') }

export default function Admin() {
  const { profile } = useAuth()
  const [semana, setSemana] = useState(null)
  const [partidos, setPartidos] = useState([])
  const [participantes, setParticipantes] = useState([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [boteInput, setBoteInput] = useState('5')
  const [msg, setMsg] = useState({ text: '', type: 'ok' })
  const [matchesDisponibles, setMatchesDisponibles] = useState(null)
  const [seleccionados, setSeleccionados] = useState(new Set())
  const [buscando, setBuscando] = useState(false)

  useEffect(() => {
    if (profile?.is_admin) loadData()
    else setLoading(false)
  }, [profile])

  async function loadData() {
    setLoading(true)
    const { data: sem } = await supabase
      .from('semanas').select('*').in('estado', ['abierta', 'cerrada'])
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    setSemana(sem)
    if (sem) {
      setBoteInput(String(sem.bote_euros))
      const { data: parts } = await supabase.from('partidos').select('*')
        .eq('semana_id', sem.id).order('fecha_partido')
      setPartidos(parts || [])
      const { data: pagos } = await supabase
        .from('pagos')
        .select('id, user_id, pagado, profiles(username)')
        .eq('semana_id', sem.id)
        .order('created_at')
      setParticipantes(pagos || [])
    }
    setLoading(false)
  }

  function showMsg(text, type = 'ok') {
    setMsg({ text, type })
    setTimeout(() => setMsg({ text: '', type: 'ok' }), 6000)
  }

  function resetSelector() { setMatchesDisponibles(null); setSeleccionados(new Set()) }

  async function buscarPartidos() {
    setBuscando(true)
    try {
      const matches = await footballFetch('upcoming')
      if (matches.length === 0) {
        showMsg('No hay partidos de Barça/Madrid en los próximos 21 días', 'warn')
      } else {
        const jornadaMin = Math.min(...matches.map(m => m.matchday).filter(Boolean))
        const presel = new Set(jornadaMin
          ? matches.filter(m => m.matchday === jornadaMin).map(m => m.id)
          : matches.slice(0, 2).map(m => m.id))
        setMatchesDisponibles(matches)
        setSeleccionados(presel)
      }
    } catch (e) { showMsg('Error de API: ' + e.message, 'err') }
    setBuscando(false)
  }

  function toggleMatch(id) {
    setSeleccionados(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function crearSemana() {
    const matches = (matchesDisponibles || []).filter(m => seleccionados.has(m.id))
    if (matches.length === 0) { showMsg('Selecciona al menos un partido', 'warn'); return }
    setWorking(true)
    try {
      const { data: lastSem } = await supabase.from('semanas').select('numero')
        .order('numero', { ascending: false }).limit(1).maybeSingle()
      const today = new Date()
      const in14 = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000)
      const nextNumero = (lastSem?.numero || 0) + 1
      const { data: newSem, error } = await supabase.from('semanas').insert({
        numero: nextNumero,
        fecha_inicio: today.toISOString().split('T')[0],
        fecha_fin: in14.toISOString().split('T')[0],
        bote_euros: parseFloat(boteInput) || 0,
        estado: 'abierta',
      }).select('id').single()
      if (error) { showMsg('Error creando semana: ' + error.message, 'err'); setWorking(false); return }
      for (const m of matches) {
        await supabase.from('partidos').insert({
          external_id: m.id, semana_id: newSem.id,
          equipo_local: m.homeTeam.shortName || m.homeTeam.name,
          equipo_visitante: m.awayTeam.shortName || m.awayTeam.name,
          equipo_local_id: m.homeTeam.id, equipo_visitante_id: m.awayTeam.id,
          fecha_partido: m.utcDate, estado: 'programado',
          es_barca: m.homeTeam.id === BARCA_ID || m.awayTeam.id === BARCA_ID,
          es_madrid: m.homeTeam.id === MADRID_ID || m.awayTeam.id === MADRID_ID,
          jornada: m.matchday,
        })
      }
      showMsg(`Semana ${nextNumero} creada con ${matches.length} partido(s)`)
      resetSelector()
      await loadData()
    } catch (e) { showMsg('Error: ' + e.message, 'err') }
    setWorking(false)
  }

  async function sincronizarResultados() {
    setWorking(true)
    try {
      const finished = await fetchFinishedMatches()
      let updated = 0
      for (const m of finished) {
        const { data: partido } = await supabase.from('partidos')
          .select('id, estado, semana_id').eq('external_id', m.id).maybeSingle()
        if (!partido || partido.estado === 'finalizado') continue
        await supabase.from('partidos').update({
          estado: 'finalizado', goles_local: m.score.fullTime.home,
          goles_visitante: m.score.fullTime.away, updated_at: new Date().toISOString(),
        }).eq('id', partido.id)
        updated++
      }
      if (semana && updated > 0) {
        const reloadedParts = await supabase.from('partidos').select('estado').eq('semana_id', semana.id)
        const todosFin = (reloadedParts.data || []).every(p => p.estado === 'finalizado')
        if (todosFin) {
          const { data: ganadores } = await supabase.rpc('verificar_ganadores', { p_semana_id: semana.id })
          if (ganadores && ganadores.length > 0) {
            await supabase.from('semanas').update({ estado: 'resuelta', ganador_id: ganadores[0].ganador_id }).eq('id', semana.id)
            showMsg(`${updated} partido(s) actualizado(s). ¡Ganador: ${ganadores[0].username}!`)
          } else {
            await supabase.from('semanas').update({ estado: 'resuelta' }).eq('id', semana.id)
            showMsg(`${updated} partido(s) actualizado(s). Nadie acertó — bote acumulado.`)
          }
        } else { showMsg(`${updated} partido(s) actualizado(s)`) }
      } else if (updated === 0) { showMsg('No hay resultados nuevos', 'warn')
      } else { showMsg(`${updated} partido(s) actualizado(s)`) }
      await loadData()
    } catch (e) { showMsg('Error: ' + e.message, 'err') }
    setWorking(false)
  }

  async function togglePago(pago) {
    setWorking(true)
    const nuevoPagado = !pago.pagado
    await supabase.from('pagos').update({ pagado: nuevoPagado }).eq('id', pago.id)
    const delta = nuevoPagado ? 5 : -5
    const nuevoBote = Math.max(0, (semana.bote_euros || 0) + delta)
    await supabase.from('semanas').update({ bote_euros: nuevoBote }).eq('id', semana.id)
    showMsg(nuevoPagado ? 'Pago confirmado (+5€ al bote)' : 'Pago retirado (-5€ del bote)')
    await loadData()
    setWorking(false)
  }

  async function actualizarBote() {
    if (!semana) return
    setWorking(true)
    const { error } = await supabase.from('semanas').update({ bote_euros: parseFloat(boteInput) || 0 }).eq('id', semana.id)
    if (error) showMsg('Error: ' + error.message, 'err')
    else showMsg('Bote actualizado')
    await loadData()
    setWorking(false)
  }

  async function togglePlazo() {
    if (!semana) return
    setWorking(true)
    if (semana.estado === 'abierta') {
      await supabase.from('semanas').update({ estado: 'cerrada' }).eq('id', semana.id)
      showMsg('Plazo cerrado — ya no se aceptan predicciones')
    } else {
      await supabase.from('semanas').update({ estado: 'abierta' }).eq('id', semana.id)
      showMsg('Plazo reabierto — los jugadores pueden volver a editar sus predicciones')
    }
    await loadData()
    setWorking(false)
  }

  if (!profile?.is_admin) return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '80px 16px', textAlign: 'center' }}>
      <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--bg3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
        <Lock size={24} color="var(--text3)" />
      </div>
      <p style={{ fontWeight: '600', marginBottom: '6px' }}>Acceso restringido</p>
      <p style={{ color: 'var(--text2)', fontSize: '13px' }}>Solo administradores</p>
    </div>
  )

  if (loading) return null

  const msgClass = msg.type === 'err' ? 'alert-error' : msg.type === 'warn' ? 'alert-warn' : 'alert-success'
  const MsgIcon = msg.type === 'err' ? AlertCircle : msg.type === 'warn' ? AlertTriangle : Check

  function SelectorNuevaSemana({ titulo = 'Nueva semana' }) {
    const porJornada = {}
    ;(matchesDisponibles || []).forEach(m => {
      const key = m.matchday || '?'
      if (!porJornada[key]) porJornada[key] = []
      porJornada[key].push(m)
    })
    return (
      <div className="card" style={{ marginBottom: '16px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '14px' }}>{titulo}</h3>
        <div style={{ marginBottom: '16px' }}>
          <label className="label">Bote (€)</label>
          <div style={{ position: 'relative' }}>
            <Wallet size={15} style={{ position: 'absolute', left: '13px', top: '50%',
              transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
            <input className="input" type="number" value={boteInput}
              onChange={e => setBoteInput(e.target.value)} min="0" step="1" style={{ paddingLeft: '36px' }} />
          </div>
        </div>
        {!matchesDisponibles ? (
          <button className="btn btn-secondary" style={{ width: '100%' }}
            onClick={buscarPartidos} disabled={buscando || working}>
            <Search size={14} />
            <span>{buscando ? 'Buscando partidos...' : 'Buscar partidos disponibles'}</span>
          </button>
        ) : (
          <>
            <p style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '12px' }}>
              {matchesDisponibles.length} partido(s) encontrado(s) — selecciona los que quieres incluir:
            </p>
            {Object.entries(porJornada).sort(([a], [b]) => Number(a) - Number(b)).map(([jornada, ms]) => (
              <div key={jornada} style={{ marginBottom: '10px' }}>
                <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text3)',
                  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                  Jornada {jornada}
                </p>
                {ms.map(m => {
                  const fecha = format(new Date(m.utcDate), "EEE d MMM, HH:mm", { locale: es })
                  const sel = seleccionados.has(m.id)
                  const esBarca = m.homeTeam.id === BARCA_ID || m.awayTeam.id === BARCA_ID
                  return (
                    <div key={m.id} onClick={() => toggleMatch(m.id)} style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '10px 12px', borderRadius: '8px', cursor: 'pointer',
                      background: sel ? 'rgba(0,200,83,0.08)' : 'var(--bg3)',
                      border: `1px solid ${sel ? 'rgba(0,200,83,0.3)' : 'var(--border)'}`,
                      marginBottom: '6px', transition: 'all 0.15s',
                    }}>
                      <div style={{ width: '18px', height: '18px', borderRadius: '4px', flexShrink: 0,
                        background: sel ? 'var(--verde)' : 'var(--bg5)',
                        border: `1.5px solid ${sel ? 'var(--verde)' : 'var(--border-strong)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                        {sel && <Check size={11} color="#000" strokeWidth={3} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '13px', fontWeight: '600', marginBottom: '1px' }}>
                          {m.homeTeam.shortName || m.homeTeam.name} vs {m.awayTeam.shortName || m.awayTeam.name}
                        </p>
                        <p style={{ fontSize: '11px', color: 'var(--text2)' }}>{fecha}</p>
                      </div>
                      <span className={`badge ${esBarca ? 'badge-azul' : 'badge-gris'}`}
                        style={{ fontSize: '10px', flexShrink: 0 }}>
                        {esBarca ? 'FCB' : 'RMA'}
                      </span>
                    </div>
                  )
                })}
              </div>
            ))}
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button className="btn btn-ghost" style={{ flex: 1, fontSize: '13px' }}
                onClick={resetSelector} disabled={working}>Cancelar</button>
              <button className="btn btn-primary" style={{ flex: 2 }}
                onClick={crearSemana} disabled={working || seleccionados.size === 0}>
                <ChevronRight size={15} />
                <span>{working ? 'Creando...' : `Crear con ${seleccionados.size} partido${seleccionados.size !== 1 ? 's' : ''}`}</span>
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '24px 16px 100px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <Settings size={18} color="var(--text2)" />
        <h1 style={{ fontSize: '22px', fontWeight: '700', letterSpacing: '-0.02em' }}>Admin</h1>
      </div>
      <p style={{ color: 'var(--text2)', fontSize: '13px', marginBottom: '24px' }}>Panel de administración de la porra</p>

      {msg.text && (
        <div className={`alert ${msgClass}`} style={{ marginBottom: '16px' }}>
          <MsgIcon size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
          <span>{msg.text}</span>
        </div>
      )}

      {!semana && <SelectorNuevaSemana />}

      {semana && (
        <>
          <div className="card" style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '600' }}>Semana {semana.numero}</h3>
              <span className={`badge badge-${semana.estado === 'abierta' ? 'verde' : 'gris'}`}>
                {semana.estado === 'abierta' ? 'Abierta' : 'Cerrada'}
              </span>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label className="label">Bote (€)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Wallet size={15} style={{ position: 'absolute', left: '13px', top: '50%',
                    transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
                  <input className="input" type="number" value={boteInput}
                    onChange={e => setBoteInput(e.target.value)} min="0" step="1" style={{ paddingLeft: '36px' }} />
                </div>
                <button className="btn btn-secondary" onClick={actualizarBote} disabled={working} style={{ flexShrink: 0 }}>
                  Guardar
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={sincronizarResultados} disabled={working}>
                <RefreshCw size={14} /><span>Sync resultados</span>
              </button>
              {semana.estado !== 'resuelta' && (
                <button className="btn btn-ghost"
                  style={{
                    flex: 1,
                    color: semana.estado === 'abierta' ? 'var(--rojo)' : 'var(--verde)',
                    borderColor: semana.estado === 'abierta' ? 'rgba(255,68,68,0.2)' : 'rgba(0,200,83,0.2)',
                  }}
                  onClick={togglePlazo} disabled={working}>
                  {semana.estado === 'abierta'
                    ? <><Lock size={14} /><span>Cerrar plazo</span></>
                    : <><Circle size={14} /><span>Reabrir plazo</span></>}
                </button>
              )}
            </div>
          </div>

          <div className="card" style={{ marginBottom: '16px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px' }}>Partidos ({partidos.length})</h3>
            {partidos.length === 0 ? (
              <p style={{ color: 'var(--text2)', fontSize: '14px' }}>Sin partidos cargados</p>
            ) : partidos.map((p, i) => {
              const fecha = format(new Date(p.fecha_partido), "EEE d MMM, HH:mm", { locale: es })
              return (
                <div key={p.id} style={{ padding: '12px 0',
                  borderBottom: i < partidos.length - 1 ? '1px solid var(--border)' : 'none',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: '600', marginBottom: '2px' }}>
                      {p.equipo_local} vs {p.equipo_visitante}
                    </p>
                    <p style={{ fontSize: '12px', color: 'var(--text2)' }}>{fecha}</p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {p.estado === 'finalizado'
                      ? <span style={{ fontFamily: 'var(--mono)', fontWeight: '700', color: 'var(--verde)' }}>{p.goles_local} – {p.goles_visitante}</span>
                      : <span className="badge badge-amarillo">Pendiente</span>}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Participantes y pagos */}
          <div className="card" style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Users size={15} color="var(--text2)" />
              <h3 style={{ fontSize: '15px', fontWeight: '600' }}>Participantes</h3>
              <span style={{ marginLeft: 'auto', fontSize: '13px', color: 'var(--text3)' }}>
                {participantes.filter(p => p.pagado).length}/{participantes.length} pagados
              </span>
            </div>
            {participantes.length === 0 ? (
              <p style={{ color: 'var(--text2)', fontSize: '14px' }}>Nadie ha enviado su apuesta aún</p>
            ) : participantes.map((p, i) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 0', borderBottom: i < participantes.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <span style={{ fontSize: '14px', fontWeight: '500' }}>{p.profiles?.username}</span>
                <button onClick={() => togglePago(p)} disabled={working}
                  className={`btn ${p.pagado ? 'btn-secondary' : 'btn-primary'}`}
                  style={{ padding: '6px 12px', fontSize: '12px', gap: '5px' }}>
                  {p.pagado ? <><X size={12} /><span>Quitar</span></> : <><Check size={12} /><span>Confirmar 5€</span></>}
                </button>
              </div>
            ))}
          </div>

          {semana.estado === 'cerrada' && <SelectorNuevaSemana titulo="Siguiente semana" />}
        </>
      )}
    </div>
  )
}
