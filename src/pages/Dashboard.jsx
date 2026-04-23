import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth.jsx'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function Dashboard() {
  const { profile } = useAuth()
  const [semana, setSemana] = useState(null)
  const [partidos, setPartidos] = useState([])
  const [ranking, setRanking] = useState([])
  const [misPredicciones, setMisPredicciones] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadDashboard() }, [profile])

  async function loadDashboard() {
    // Semana activa
    const { data: sem } = await supabase
      .from('semanas')
      .select('*')
      .eq('estado', 'abierta')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setSemana(sem)

    if (sem) {
      // Partidos de la semana
      const { data: parts } = await supabase
        .from('partidos')
        .select('*')
        .eq('semana_id', sem.id)
        .order('fecha_partido')
      setPartidos(parts || [])

      // Mis predicciones
      if (profile) {
        const { data: preds } = await supabase
          .from('predicciones')
          .select('*, partidos(*)')
          .eq('semana_id', sem.id)
          .eq('user_id', profile.id)
        setMisPredicciones(preds || [])
      }

      // Ranking histórico (aciertos)
      const { data: rank } = await supabase
        .from('predicciones')
        .select('user_id, profiles(username), es_correcto')
        .not('es_correcto', 'is', null)

      if (rank) {
        const grouped = {}
        rank.forEach(r => {
          const key = r.user_id
          if (!grouped[key]) grouped[key] = { username: r.profiles?.username, aciertos: 0, total: 0 }
          grouped[key].total++
          if (r.es_correcto) grouped[key].aciertos++
        })
        const sorted = Object.values(grouped).sort((a, b) => b.aciertos - a.aciertos).slice(0, 8)
        setRanking(sorted)
      }
    }
    setLoading(false)
  }

  if (loading) return null

  const miPredCount = misPredicciones.length
  const partidosCount = partidos.length
  const todosPredecidos = miPredCount >= partidosCount && partidosCount > 0

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700' }}>
          Hola, {profile?.username} 👋
        </h1>
        <p style={{ color: 'var(--text2)', marginTop: '4px' }}>
          {semana ? `Semana ${semana.numero} en juego` : 'Esperando nueva semana'}
        </p>
      </div>

      {/* Bote actual */}
      {semana && (
        <div className="card" style={{
          background: 'linear-gradient(135deg, #0f2a1a, #1a3a28)',
          border: '1px solid rgba(0,200,83,0.2)',
          marginBottom: '16px',
          textAlign: 'center'
        }}>
          <p style={{ color: 'var(--verde)', fontSize: '12px', fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>
            💰 Bote acumulado
          </p>
          <p style={{ fontSize: '48px', fontWeight: '700', fontFamily: 'var(--mono)', color: '#fff' }}>
            {semana.bote_euros}€
          </p>
          <p style={{ color: 'var(--text2)', fontSize: '13px', marginTop: '8px' }}>
            Semana {semana.numero} · {partidosCount} partido{partidosCount !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* Estado de mis predicciones */}
      {semana && (
        <div className="card" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '600' }}>Mis predicciones</h3>
            <span style={{ fontSize: '13px', color: todosPredecidos ? 'var(--verde)' : 'var(--amarillo)' }}>
              {miPredCount}/{partidosCount} hechas
            </span>
          </div>

          {partidos.length === 0 ? (
            <p style={{ color: 'var(--text2)', fontSize: '14px' }}>Cargando partidos...</p>
          ) : partidos.map(partido => {
            const pred = misPredicciones.find(p => p.partido_id === partido.id)
            const fechaStr = format(new Date(partido.fecha_partido), "EEE d MMM, HH:mm", { locale: es })

            return (
              <div key={partido.id} style={{
                padding: '12px 0', borderBottom: '1px solid var(--border)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: '600', marginBottom: '3px' }}>
                    {partido.es_barca ? '🔵🔴' : '⚪'} {partido.equipo_local} vs {partido.equipo_visitante}
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--text2)' }}>{fechaStr}</p>
                </div>
                {pred ? (
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: '18px', fontWeight: '700', color: 'var(--verde)' }}>
                      {pred.goles_local_prediccion} - {pred.goles_visitante_prediccion}
                    </span>
                    {pred.es_correcto !== null && (
                      <div style={{ marginTop: '2px' }}>
                        <span className={`badge badge-${pred.es_correcto ? 'verde' : 'rojo'}`}>
                          {pred.es_correcto ? '✓ Acertado' : '✗ Fallado'}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="badge badge-amarillo">Sin predicción</span>
                )}
              </div>
            )
          })}

          {!todosPredecidos && partidosCount > 0 && (
            <Link to="/predicciones">
              <button className="btn btn-primary" style={{ width: '100%', marginTop: '16px' }}>
                ✏️ Poner mis predicciones
              </button>
            </Link>
          )}
        </div>
      )}

      {/* Ranking */}
      {ranking.length > 0 && (
        <div className="card">
          <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px' }}>🏆 Ranking total</h3>
          {ranking.map((r, i) => (
            <div key={r.username} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 0', borderBottom: i < ranking.length - 1 ? '1px solid var(--border)' : 'none'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  background: i === 0 ? 'var(--amarillo)' : i === 1 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)',
                  color: i === 0 ? '#000' : 'var(--text)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '13px', fontWeight: '700'
                }}>
                  {i + 1}
                </span>
                <span style={{ fontSize: '15px', fontWeight: profile?.username === r.username ? '700' : '400' }}>
                  {r.username} {profile?.username === r.username ? '(tú)' : ''}
                </span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontFamily: 'var(--mono)', fontWeight: '700', color: 'var(--verde)' }}>
                  {r.aciertos}
                </span>
                <span style={{ color: 'var(--text3)', fontSize: '12px' }}> / {r.total}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
