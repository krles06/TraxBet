import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth.jsx'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { BarChart2, Trophy, Circle, Inbox } from 'lucide-react'

export default function Resultados() {
  const { profile } = useAuth()
  const [semanas, setSemanas] = useState([])
  const [semanaSeleccionada, setSemanaSeleccionada] = useState(null)
  const [partidos, setPartidos] = useState([])
  const [predicciones, setPredicciones] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadSemanas() }, [])
  useEffect(() => { if (semanaSeleccionada) loadDetalle() }, [semanaSeleccionada])

  useEffect(() => {
    const channel = supabase
      .channel('resultados-partidos')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'partidos' }, () => {
        if (semanaSeleccionada) loadDetalle()
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'semanas' }, () => {
        loadSemanas()
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [semanaSeleccionada])

  async function loadSemanas() {
    const { data } = await supabase
      .from('semanas')
      .select('*')
      .order('numero', { ascending: false })
    setSemanas(data || [])
    if (data?.length) setSemanaSeleccionada(data[0])
    setLoading(false)
  }

  async function loadDetalle() {
    const { data: parts } = await supabase
      .from('partidos')
      .select('*')
      .eq('semana_id', semanaSeleccionada.id)
      .order('fecha_partido')
    setPartidos(parts || [])

    const finalizados = (parts || []).filter(p => p.estado === 'finalizado').map(p => p.id)
    if (finalizados.length > 0) {
      const { data: preds } = await supabase
        .from('predicciones')
        .select('*, profiles(username)')
        .in('partido_id', finalizados)
      setPredicciones(preds || [])
    } else {
      setPredicciones([])
    }
  }

  function getPredsForPartido(partidoId) {
    return predicciones.filter(p => p.partido_id === partidoId)
  }

  if (loading) return null

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '24px 16px 100px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
        <BarChart2 size={20} color="var(--verde)" />
        <h1 style={{ fontSize: '22px', fontWeight: '700', letterSpacing: '-0.02em' }}>Resultados</h1>
      </div>

      {/* Selector de semana */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', overflowX: 'auto', paddingBottom: '4px' }}>
        {semanas.map(s => (
          <button
            key={s.id}
            onClick={() => setSemanaSeleccionada(s)}
            className={`btn ${semanaSeleccionada?.id === s.id ? 'btn-primary' : 'btn-ghost'}`}
            style={{ whiteSpace: 'nowrap', flexShrink: 0, padding: '8px 14px', fontSize: '13px' }}
          >
            Sem {s.numero}
            {s.estado === 'abierta' && (
              <Circle size={7} fill="var(--verde)" color="var(--verde)" style={{ marginLeft: '4px' }} />
            )}
          </button>
        ))}
      </div>

      {semanaSeleccionada && (
        <>
          {/* Info semana */}
          <div className="card" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Semana {semanaSeleccionada.numero}
              </p>
              <p style={{ fontFamily: 'var(--mono)', fontSize: '28px', fontWeight: '700', color: 'var(--verde)', lineHeight: 1 }}>
                {semanaSeleccionada.bote_euros}€
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className={`badge badge-${
                semanaSeleccionada.estado === 'resuelta' ? 'verde' :
                semanaSeleccionada.estado === 'abierta' ? 'amarillo' : 'gris'
              }`}>
                {semanaSeleccionada.estado === 'resuelta' ? 'Resuelta' :
                 semanaSeleccionada.estado === 'abierta' ? 'En juego' : 'Cerrada'}
              </span>
              {semanaSeleccionada.ganador_id && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', justifyContent: 'flex-end', marginTop: '8px' }}>
                  <Trophy size={13} color="var(--amarillo)" />
                  <p style={{ fontSize: '12px', color: 'var(--amarillo)', fontWeight: '600' }}>Ganador verificado</p>
                </div>
              )}
            </div>
          </div>

          {/* Partidos */}
          {partidos.map(partido => {
            const preds = getPredsForPartido(partido.id)
            const finalizado = partido.estado === 'finalizado'
            const fecha = format(new Date(partido.fecha_partido), "d MMM, HH:mm", { locale: es })

            return (
              <div key={partido.id} className="card" style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: finalizado && preds.length > 0 ? '16px' : '0' }}>
                  <div>
                    <p style={{ fontSize: '15px', fontWeight: '700', marginBottom: '3px' }}>
                      {partido.equipo_local} vs {partido.equipo_visitante}
                    </p>
                    <p style={{ fontSize: '12px', color: 'var(--text2)' }}>{fecha}</p>
                  </div>
                  {finalizado ? (
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Final</p>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: '22px', fontWeight: '700', color: 'var(--verde)' }}>
                        {partido.goles_local} – {partido.goles_visitante}
                      </span>
                    </div>
                  ) : (
                    <span className="badge badge-amarillo">Pendiente</span>
                  )}
                </div>

                {finalizado && preds.length > 0 && (
                  <>
                    <div className="divider" style={{ marginBottom: '12px' }} />
                    <p style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Predicciones ({preds.length})
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {preds.map(pred => {
                        const esTuyo = pred.user_id === profile?.id
                        return (
                          <div key={pred.id} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '9px 12px',
                            background: pred.es_correcto
                              ? 'rgba(0,200,83,0.1)'
                              : esTuyo ? 'rgba(255,255,255,0.04)' : 'transparent',
                            borderRadius: '8px',
                            border: pred.es_correcto
                              ? '1px solid rgba(0,200,83,0.3)'
                              : esTuyo ? '1px solid var(--border)' : 'none',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                              {pred.es_correcto && <Trophy size={13} color="var(--amarillo)" />}
                              <span style={{ fontSize: '14px', fontWeight: esTuyo ? '700' : '400' }}>
                                {pred.profiles?.username}{esTuyo ? ' (tú)' : ''}
                              </span>
                            </div>
                            <span style={{
                              fontFamily: 'var(--mono)', fontWeight: '700', fontSize: '15px',
                              color: pred.es_correcto ? 'var(--verde)' : pred.es_correcto === false ? 'var(--text2)' : 'var(--text)',
                            }}>
                              {pred.goles_local_prediccion} – {pred.goles_visitante_prediccion}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}

                {!finalizado && (
                  <p style={{ fontSize: '13px', color: 'var(--text3)', textAlign: 'center', paddingTop: '12px' }}>
                    Las predicciones se revelan cuando termine el partido
                  </p>
                )}
              </div>
            )
          })}
        </>
      )}

      {semanas.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '50%',
            background: 'var(--bg4)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', margin: '0 auto 16px',
          }}>
            <Inbox size={22} color="var(--text3)" />
          </div>
          <p style={{ fontWeight: '600', marginBottom: '6px' }}>Sin semanas registradas</p>
          <p style={{ color: 'var(--text2)', fontSize: '13px' }}>Las semanas aparecerán aquí cuando el administrador las cree</p>
        </div>
      )}
    </div>
  )
}
