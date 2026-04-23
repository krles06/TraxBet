import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth.jsx'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function Predicciones() {
  const { profile } = useAuth()
  const [semana, setSemana] = useState(null)
  const [partidos, setPartidos] = useState([])
  const [predicciones, setPredicciones] = useState({})
  const [guardado, setGuardado] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

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
              visitante: String(p.goles_visitante_prediccion)
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
    setPredicciones(p => ({
      ...p,
      [partidoId]: { ...p[partidoId], [tipo]: clean }
    }))
    setGuardado(g => ({ ...g, [partidoId]: false }))
  }

  async function guardarPrediccion(partido) {
    if (!profile || !semana) return
    const pred = predicciones[partido.id]
    if (pred?.local === undefined || pred?.visitante === undefined) return
    if (pred.local === '' || pred.visitante === '') return

    setSaving(true)
    const data = {
      user_id: profile.id,
      semana_id: semana.id,
      partido_id: partido.id,
      goles_local_prediccion: parseInt(pred.local),
      goles_visitante_prediccion: parseInt(pred.visitante),
    }

    const { error } = await supabase
      .from('predicciones')
      .upsert(data, { onConflict: 'user_id,partido_id' })

    if (!error) {
      setGuardado(g => ({ ...g, [partido.id]: true }))
    }
    setSaving(false)
  }

  const programados = partidos.filter(p => p.estado === 'programado')
  const primerPartido = programados.length > 0
    ? programados.reduce((min, p) => new Date(p.fecha_partido) < new Date(min.fecha_partido) ? p : min)
    : null
  const deadline = primerPartido
    ? new Date(new Date(primerPartido.fecha_partido).getTime() - 3 * 60 * 60 * 1000)
    : null
  const plazoVencido = deadline ? new Date() >= deadline : partidos.length > 0

  const partidoAbierto = (p) => !plazoVencido && p.estado === 'programado'

  if (loading) return null

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '8px' }}>✏️ Mis predicciones</h1>
      {semana && (
        <p style={{ color: 'var(--text2)', marginBottom: '16px', fontSize: '14px' }}>
          Semana {semana.numero} · Bote: <strong style={{ color: 'var(--verde)' }}>{semana.bote_euros}€</strong>
        </p>
      )}

      {/* Banner de plazo */}
      {deadline && !plazoVencido && (
        <div style={{
          background: 'rgba(255,214,0,0.08)', border: '1px solid rgba(255,214,0,0.2)',
          borderRadius: '10px', padding: '12px 16px', marginBottom: '20px',
          display: 'flex', alignItems: 'center', gap: '10px'
        }}>
          <span style={{ fontSize: '18px' }}>⏰</span>
          <div>
            <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--amarillo)' }}>Plazo de predicciones</p>
            <p style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '2px' }}>
              Cierra el {format(deadline, "EEEE d MMM 'a las' HH:mm", { locale: es })}
            </p>
          </div>
        </div>
      )}
      {deadline && plazoVencido && programados.length > 0 && (
        <div style={{
          background: 'rgba(255,61,61,0.08)', border: '1px solid rgba(255,61,61,0.2)',
          borderRadius: '10px', padding: '12px 16px', marginBottom: '20px',
          display: 'flex', alignItems: 'center', gap: '10px'
        }}>
          <span style={{ fontSize: '18px' }}>🔒</span>
          <div>
            <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--rojo)' }}>Plazo cerrado</p>
            <p style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '2px' }}>
              El plazo venció el {format(deadline, "d MMM 'a las' HH:mm", { locale: es })}
            </p>
          </div>
        </div>
      )}

      {!semana && (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <p style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</p>
          <p style={{ color: 'var(--text2)' }}>No hay semana activa. El administrador debe crear una nueva semana.</p>
        </div>
      )}

      {partidos.map(partido => {
        const pred = predicciones[partido.id] || { local: '', visitante: '' }
        const abierto = partidoAbierto(partido)
        const estaGuardado = guardado[partido.id]
        const fecha = format(new Date(partido.fecha_partido), "EEEE d MMM, HH:mm", { locale: es })

        return (
          <div key={partido.id} className="card" style={{ marginBottom: '16px' }}>
            {/* Cabecera del partido */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span className={`badge ${partido.es_barca ? 'badge-azul' : 'badge-gris'}`} style={{
                    background: partido.es_barca ? 'rgba(0,100,255,0.15)' : 'rgba(255,255,255,0.08)',
                    color: partido.es_barca ? '#4d9fff' : 'var(--text2)',
                    marginBottom: '8px'
                  }}>
                    {partido.es_barca ? '🔵🔴 Barcelona' : '⚪ Real Madrid'}
                  </span>
                  <p style={{ fontSize: '17px', fontWeight: '700', marginBottom: '4px' }}>
                    {partido.equipo_local} vs {partido.equipo_visitante}
                  </p>
                  <p style={{ color: 'var(--text2)', fontSize: '13px' }}>📅 {fecha}</p>
                </div>
                {!abierto && partido.estado === 'finalizado' && (
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '4px' }}>Resultado</p>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: '20px', fontWeight: '700' }}>
                      {partido.goles_local} - {partido.goles_visitante}
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
                    <p style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '6px', fontWeight: '600' }}>
                      {partido.equipo_local}
                    </p>
                    <input
                      className="input"
                      type="text" inputMode="numeric" minLength="0" maxLength="2"
                      value={pred.local}
                      onChange={e => setGol(partido.id, 'local', e.target.value)}
                      placeholder="0"
                      style={{ textAlign: 'center', fontSize: '28px', fontWeight: '700', fontFamily: 'var(--mono)', padding: '12px 8px' }}
                    />
                  </div>
                  <div style={{ fontSize: '24px', color: 'var(--text3)', paddingTop: '20px' }}>-</div>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <p style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '6px', fontWeight: '600' }}>
                      {partido.equipo_visitante}
                    </p>
                    <input
                      className="input"
                      type="text" inputMode="numeric" minLength="0" maxLength="2"
                      value={pred.visitante}
                      onChange={e => setGol(partido.id, 'visitante', e.target.value)}
                      placeholder="0"
                      style={{ textAlign: 'center', fontSize: '28px', fontWeight: '700', fontFamily: 'var(--mono)', padding: '12px 8px' }}
                    />
                  </div>
                </div>

                <button
                  className={`btn ${estaGuardado ? 'btn-secondary' : 'btn-primary'}`}
                  style={{ width: '100%' }}
                  disabled={saving || pred.local === '' || pred.visitante === ''}
                  onClick={() => guardarPrediccion(partido)}
                >
                  {estaGuardado ? '✓ Guardado' : saving ? 'Guardando...' : 'Guardar predicción'}
                </button>
              </>
            ) : (
              <div style={{
                background: 'var(--bg3)', borderRadius: '8px', padding: '16px', textAlign: 'center'
              }}>
                {partido.estado === 'finalizado' ? (
                  <>
                    <p style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '8px' }}>Tu predicción fue:</p>
                    {pred.local !== '' ? (
                      <span style={{ fontFamily: 'var(--mono)', fontSize: '24px', fontWeight: '700' }}>
                        {pred.local} - {pred.visitante}
                      </span>
                    ) : (
                      <p style={{ color: 'var(--rojo)' }}>❌ No pusiste predicción</p>
                    )}
                  </>
                ) : (
                  <p style={{ color: 'var(--text2)', fontSize: '13px' }}>
                    🔒 Partido ya comenzado, no se puede modificar
                  </p>
                )}
              </div>
            )}
          </div>
        )
      })}

      {partidos.length > 0 && (
        <div className="card" style={{ background: 'rgba(0,200,83,0.05)', border: '1px solid rgba(0,200,83,0.15)', marginTop: '8px' }}>
          <p style={{ fontSize: '13px', color: 'var(--text2)', textAlign: 'center', lineHeight: '1.6' }}>
            💡 Debes acertar el marcador exacto de <strong style={{ color: 'var(--text)' }}>los dos partidos</strong> para ganar el bote.<br />
            Si nadie acierta, se acumula para la siguiente semana.
          </p>
        </div>
      )}
    </div>
  )
}
