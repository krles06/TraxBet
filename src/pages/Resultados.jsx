import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth.jsx'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function Resultados() {
  const { profile } = useAuth()
  const [semanas, setSemanas] = useState([])
  const [semanaSeleccionada, setSemanaSeleccionada] = useState(null)
  const [partidos, setPartidos] = useState([])
  const [predicciones, setPredicciones] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadSemanas() }, [])
  useEffect(() => { if (semanaSeleccionada) loadDetalle() }, [semanaSeleccionada])

  // Actualización en tiempo real cuando cambia un partido o semana
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

    // Predicciones de partidos finalizados (visibles para todos)
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
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '20px' }}>📊 Resultados</h1>

      {/* Selector de semana */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', overflowX: 'auto', paddingBottom: '4px' }}>
        {semanas.map(s => (
          <button
            key={s.id}
            onClick={() => setSemanaSeleccionada(s)}
            className={`btn ${semanaSeleccionada?.id === s.id ? 'btn-primary' : 'btn-secondary'}`}
            style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            Sem {s.numero}
            {s.estado === 'abierta' && <span style={{ marginLeft: '4px', fontSize: '8px' }}>🟢</span>}
          </button>
        ))}
      </div>

      {semanaSeleccionada && (
        <>
          {/* Info semana */}
          <div className="card" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '4px' }}>Semana {semanaSeleccionada.numero}</p>
              <p style={{ fontFamily: 'var(--mono)', fontSize: '24px', fontWeight: '700', color: 'var(--verde)' }}>
                {semanaSeleccionada.bote_euros}€
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className={`badge badge-${
                semanaSeleccionada.estado === 'resuelta' ? 'verde' :
                semanaSeleccionada.estado === 'abierta' ? 'amarillo' : 'gris'
              }`}>
                {semanaSeleccionada.estado === 'resuelta' ? '✓ Resuelta' :
                 semanaSeleccionada.estado === 'abierta' ? '🟢 En juego' : 'Cerrada'}
              </span>
              {semanaSeleccionada.ganador_id && (
                <p style={{ fontSize: '13px', marginTop: '8px', color: 'var(--verde)' }}>
                  🏆 Ganador verificado
                </p>
              )}
            </div>
          </div>

          {/* Partidos con predicciones */}
          {partidos.map(partido => {
            const preds = getPredsForPartido(partido.id)
            const finalizado = partido.estado === 'finalizado'
            const fecha = format(new Date(partido.fecha_partido), "d MMM, HH:mm", { locale: es })

            return (
              <div key={partido.id} className="card" style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div>
                    <p style={{ fontSize: '15px', fontWeight: '700', marginBottom: '3px' }}>
                      {partido.equipo_local} vs {partido.equipo_visitante}
                    </p>
                    <p style={{ fontSize: '12px', color: 'var(--text2)' }}>{fecha}</p>
                  </div>
                  {finalizado ? (
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '4px' }}>Final</p>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: '22px', fontWeight: '700', color: 'var(--verde)' }}>
                        {partido.goles_local} - {partido.goles_visitante}
                      </span>
                    </div>
                  ) : (
                    <span className="badge badge-amarillo">Pendiente</span>
                  )}
                </div>

                {finalizado && preds.length > 0 && (
                  <>
                    <p style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Predicciones ({preds.length})
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {preds.map(pred => {
                        const esTuyo = pred.user_id === profile?.id
                        return (
                          <div key={pred.id} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '10px 12px',
                            background: pred.es_correcto ? 'rgba(0,200,83,0.1)' : esTuyo ? 'rgba(255,255,255,0.04)' : 'transparent',
                            borderRadius: '8px',
                            border: pred.es_correcto ? '1px solid rgba(0,200,83,0.3)' :
                                    esTuyo ? '1px solid var(--border)' : 'none'
                          }}>
                            <span style={{ fontSize: '14px', fontWeight: esTuyo ? '700' : '400' }}>
                              {pred.profiles?.username} {esTuyo ? '(tú)' : ''}
                              {pred.es_correcto && ' 🏆'}
                            </span>
                            <span style={{
                              fontFamily: 'var(--mono)', fontWeight: '700',
                              color: pred.es_correcto ? 'var(--verde)' : pred.es_correcto === false ? 'var(--text2)' : 'var(--text)'
                            }}>
                              {pred.goles_local_prediccion} - {pred.goles_visitante_prediccion}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}

                {!finalizado && (
                  <p style={{ fontSize: '13px', color: 'var(--text3)', textAlign: 'center', padding: '8px 0' }}>
                    Las predicciones se revelan cuando termine el partido
                  </p>
                )}
              </div>
            )
          })}
        </>
      )}

      {semanas.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <p style={{ fontSize: '32px', marginBottom: '12px' }}>📭</p>
          <p style={{ color: 'var(--text2)' }}>Todavía no hay semanas registradas</p>
        </div>
      )}
    </div>
  )
}
