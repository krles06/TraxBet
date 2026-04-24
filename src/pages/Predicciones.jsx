import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth.jsx'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Clock, Lock, Check, AlertCircle, Info, Calendar, Flame } from 'lucide-react'
import { useCountdown } from '../hooks/useCountdown.js'

export default function Predicciones() {
  const { profile } = useAuth()
  const [semana, setSemana] = useState(null)
  const [partidos, setPartidos] = useState([])
  const [predicciones, setPredicciones] = useState({})
  const [guardado, setGuardado] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorDuplicado, setErrorDuplicado] = useState('')

  useEffect(() => { loadData() }, [profile])

  async function loadData() {
    const { data: sem } = await supabase
      .from('semanas')
      .select('*')
      .eq('estado', 'abierta')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setSemana(sem)

    if (sem) {
      const { data: parts } = await supabase
        .from('partidos')
        .select('*')
        .eq('semana_id', sem.id)
        .order('fecha_partido')
      setPartidos(parts || [])

      if (profile) {
        const { data: preds } = await supabase
          .from('predicciones')
          .select('*')
          .eq('semana_id', sem.id)
          .eq('user_id', profile.id)

        if (preds) {
          const map = {}
          const guardadoMap = {}
          preds.forEach(p => {
            map[p.partido_id] = {
              local: String(p.goles_local_prediccion),
              visitante: String(p.goles_visitante_prediccion),
            }
            guardadoMap[p.partido_id] = true
          })
          setPredicciones(map)
          setGuardado(guardadoMap)
        }
      }
    }
    setLoading(false)
  }

  function setGol(partidoId, tipo, val) {
    const clean = String(val).replace(/\D/g, '').slice(0, 2)
    setPredicciones(p => ({ ...p, [partidoId]: { ...p[partidoId], [tipo]: clean } }))
    setGuardado(g => ({ ...g, [partidoId]: false }))
  }

  async function checkDuplicado(partidoId, nuevaPred) {
    const misPreds = { ...predicciones, [partidoId]: nuevaPred }
    const todasRellenas = partidos.every(p => {
      const pr = misPreds[p.id]
      return pr && pr.local !== '' && pr.visitante !== ''
    })
    if (!todasRellenas) return false

    const prediccionesArray = partidos.map(p => ({
      partido_id: p.id,
      goles_local: parseInt(misPreds[p.id].local),
      goles_visitante: parseInt(misPreds[p.id].visitante),
    }))

    const { data } = await supabase.rpc('check_prediccion_duplicada', {
      p_semana_id: semana.id,
      p_user_id: profile.id,
      p_predicciones: prediccionesArray,
    })

    return data === true
  }

  async function guardarPrediccion(partido) {
    if (!profile || !semana) return
    const pred = predicciones[partido.id]
    if (pred?.local === undefined || pred?.visitante === undefined) return
    if (pred.local === '' || pred.visitante === '') return

    setSaving(true)
    setErrorDuplicado('')

    const esDuplicado = await checkDuplicado(partido.id, pred)
    if (esDuplicado) {
      setErrorDuplicado('Este combinado exacto ya lo tiene otro participante. Cambia al menos uno de los dos marcadores.')
      setSaving(false)
      return
    }

    const { error } = await supabase
      .from('predicciones')
      .upsert({
        user_id: profile.id,
        semana_id: semana.id,
        partido_id: partido.id,
        goles_local_prediccion: parseInt(pred.local),
        goles_visitante_prediccion: parseInt(pred.visitante),
      }, { onConflict: 'user_id,partido_id' })

    if (!error) setGuardado(g => ({ ...g, [partido.id]: true }))
    setSaving(false)
  }

  const programados = partidos.filter(p => p.estado === 'programado')
  const primerPartido = programados.length > 0
    ? programados.reduce((min, p) => new Date(p.fecha_partido) < new Date(min.fecha_partido) ? p : min)
    : null
  const deadline = primerPartido
    ? new Date(new Date(primerPartido.fecha_partido).getTime() - 3 * 60 * 60 * 1000)
    : null
  const countdown = useCountdown(deadline)
  const plazoVencido = countdown ? countdown.expired : partidos.length > 0

  const partidoAbierto = (p) => !plazoVencido && p.estado === 'programado'

  if (loading) return null

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '24px 16px 100px' }}>
      <h1 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '6px', letterSpacing: '-0.02em' }}>
        Mis predicciones
      </h1>
      {semana && (
        <p style={{ color: 'var(--text2)', marginBottom: '20px', fontSize: '14px' }}>
          Semana {semana.numero} · Bote: <strong style={{ color: 'var(--verde)' }}>{semana.bote_euros}€</strong>
        </p>
      )}

      {/* Banner de plazo */}
      {countdown && !countdown.expired && (
        <div className={`alert ${countdown.urgent ? 'alert-error' : 'alert-warn'}`} style={{ marginBottom: '20px' }}>
          {countdown.urgent ? <Flame size={15} style={{ flexShrink: 0 }} /> : <Clock size={15} style={{ flexShrink: 0 }} />}
          <div>
            <p style={{ fontWeight: '600', marginBottom: '2px' }}>
              {countdown.urgent ? '¡Cierra pronto!' : 'Plazo de predicciones'}
            </p>
            <p style={{ fontSize: '12px', opacity: 0.85, fontFamily: 'var(--mono)' }}>
              {countdown.horas > 0 ? `${countdown.horas}h ` : ''}{String(countdown.minutos).padStart(2, '0')}m {String(countdown.segundos).padStart(2, '0')}s
            </p>
          </div>
        </div>
      )}
      {countdown && countdown.expired && programados.length > 0 && (
        <div className="alert alert-error" style={{ marginBottom: '20px' }}>
          <Lock size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
          <div>
            <p style={{ fontWeight: '600', marginBottom: '2px' }}>Plazo cerrado</p>
            <p style={{ fontSize: '12px', opacity: 0.85 }}>
              Venció el {deadline && format(deadline, "d MMM 'a las' HH:mm", { locale: es })}
            </p>
          </div>
        </div>
      )}

      {!semana && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '50%',
            background: 'var(--bg4)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', margin: '0 auto 16px',
          }}>
            <Clock size={22} color="var(--text3)" />
          </div>
          <p style={{ fontWeight: '600', marginBottom: '6px' }}>Sin semana activa</p>
          <p style={{ color: 'var(--text2)', fontSize: '13px' }}>El administrador debe crear una nueva semana</p>
        </div>
      )}

      {partidos.map(partido => {
        const pred = predicciones[partido.id] || { local: '', visitante: '' }
        const abierto = partidoAbierto(partido)
        const estaGuardado = guardado[partido.id]
        const fecha = format(new Date(partido.fecha_partido), "EEEE d MMM, HH:mm", { locale: es })

        return (
          <div key={partido.id} className="card" style={{ marginBottom: '16px' }}>
            {/* Cabecera */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <span className={`badge ${partido.es_barca ? 'badge-azul' : 'badge-gris'}`} style={{ marginBottom: '8px' }}>
                    {partido.es_barca ? 'Barcelona' : 'Real Madrid'}
                  </span>
                  <p style={{ fontSize: '16px', fontWeight: '700', marginBottom: '5px', lineHeight: 1.3 }}>
                    {partido.equipo_local} vs {partido.equipo_visitante}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text2)' }}>
                    <Calendar size={12} />
                    <p style={{ fontSize: '12px' }}>{fecha}</p>
                  </div>
                </div>
                {!abierto && partido.estado === 'finalizado' && (
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Resultado</p>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: '22px', fontWeight: '700' }}>
                      {partido.goles_local} – {partido.goles_visitante}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Input de predicción */}
            {abierto ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <p style={{ fontSize: '11px', color: 'var(--text2)', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {partido.equipo_local}
                    </p>
                    <input
                      className="input"
                      type="text" inputMode="numeric" maxLength="2"
                      value={pred.local}
                      onChange={e => setGol(partido.id, 'local', e.target.value)}
                      placeholder="0"
                      style={{ textAlign: 'center', fontSize: '32px', fontWeight: '700', fontFamily: 'var(--mono)', padding: '14px 8px' }}
                    />
                  </div>
                  <div style={{ fontSize: '20px', color: 'var(--text3)', paddingTop: '22px', flexShrink: 0 }}>–</div>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <p style={{ fontSize: '11px', color: 'var(--text2)', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {partido.equipo_visitante}
                    </p>
                    <input
                      className="input"
                      type="text" inputMode="numeric" maxLength="2"
                      value={pred.visitante}
                      onChange={e => setGol(partido.id, 'visitante', e.target.value)}
                      placeholder="0"
                      style={{ textAlign: 'center', fontSize: '32px', fontWeight: '700', fontFamily: 'var(--mono)', padding: '14px 8px' }}
                    />
                  </div>
                </div>

                <button
                  className={`btn ${estaGuardado ? 'btn-secondary' : 'btn-primary'}`}
                  style={{ width: '100%' }}
                  disabled={saving || pred.local === '' || pred.visitante === ''}
                  onClick={() => guardarPrediccion(partido)}
                >
                  {estaGuardado
                    ? <><Check size={15} strokeWidth={2.5} /><span>Guardado</span></>
                    : saving ? 'Guardando...' : 'Guardar predicción'}
                </button>
              </>
            ) : (
              <div style={{ background: 'var(--bg3)', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
                {partido.estado === 'finalizado' ? (
                  <>
                    <p style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Tu predicción</p>
                    {pred.local !== '' ? (
                      <span style={{ fontFamily: 'var(--mono)', fontSize: '28px', fontWeight: '700' }}>
                        {pred.local} – {pred.visitante}
                      </span>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                        <AlertCircle size={14} color="var(--rojo)" />
                        <p style={{ color: 'var(--rojo)', fontSize: '13px' }}>No pusiste predicción</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                    <Lock size={13} color="var(--text3)" />
                    <p style={{ color: 'var(--text2)', fontSize: '13px' }}>No se puede modificar</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {errorDuplicado && (
        <div className="alert alert-error" style={{ marginTop: '8px' }}>
          <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
          <p style={{ lineHeight: '1.5' }}>{errorDuplicado}</p>
        </div>
      )}

      {partidos.length > 0 && (
        <div className="alert alert-info" style={{ marginTop: '12px' }}>
          <Info size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
          <p style={{ lineHeight: '1.6' }}>
            Debes acertar el marcador exacto de <strong style={{ color: 'var(--text)' }}>los dos partidos</strong> para ganar.
            No puedes repetir el combinado de otro participante.
            Si nadie acierta, el bote se acumula.
          </p>
        </div>
      )}
    </div>
  )
}
