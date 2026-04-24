import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth.jsx'
import { useCountdown } from '../hooks/useCountdown.js'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Wallet, Trophy, Clock, Lock, Check, X, PenLine, Users, Share2, Flame } from 'lucide-react'

const ONBOARDING_KEY = 'traxallbets_onboarded'

export default function Dashboard() {
  const { profile } = useAuth()
  const [semana, setSemana] = useState(null)
  const [partidos, setPartidos] = useState([])
  const [ranking, setRanking] = useState([])
  const [misPredicciones, setMisPredicciones] = useState([])
  const [participantes, setParticipantes] = useState([])
  const [lastResolved, setLastResolved] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showOnboarding, setShowOnboarding] = useState(false)

  const programados = partidos.filter(p => p.estado === 'programado')
  const primerPartido = programados.length > 0
    ? programados.reduce((min, p) => new Date(p.fecha_partido) < new Date(min.fecha_partido) ? p : min)
    : null
  const deadline = primerPartido
    ? new Date(new Date(primerPartido.fecha_partido).getTime() - 3 * 60 * 60 * 1000)
    : null
  const countdown = useCountdown(deadline)

  useEffect(() => {
    if (!localStorage.getItem(ONBOARDING_KEY)) setShowOnboarding(true)
  }, [])

  useEffect(() => { loadDashboard() }, [profile])

  useEffect(() => {
    const channel = supabase
      .channel('dashboard-partidos')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'partidos' }, () => loadDashboard())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'semanas' }, () => loadDashboard())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  async function loadDashboard() {
    const { data: sem } = await supabase
      .from('semanas')
      .select('*')
      .eq('estado', 'abierta')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setSemana(sem)

    const { data: resolved } = await supabase
      .from('semanas')
      .select('*, ganador:profiles!ganador_id(username)')
      .eq('estado', 'resuelta')
      .order('numero', { ascending: false })
      .limit(1)
      .maybeSingle()
    setLastResolved(resolved)

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
          .select('*, partidos(*)')
          .eq('semana_id', sem.id)
          .eq('user_id', profile.id)
        setMisPredicciones(preds || [])
      }

      const { data: pagosData } = await supabase
        .from('pagos')
        .select('id, user_id, pagado, profiles(username)')
        .eq('semana_id', sem.id)
        .order('created_at')
      setParticipantes(pagosData || [])

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

  function dismissOnboarding() {
    localStorage.setItem(ONBOARDING_KEY, '1')
    setShowOnboarding(false)
  }

  function shareWhatsApp() {
    const text = `¡He puesto mis predicciones en TraxallBets esta semana! ⚽🏆\n¿Alguien más se atreve a adivinar los marcadores exactos?`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  if (loading) return null

  const miPredCount = misPredicciones.length
  const partidosCount = partidos.length
  const todosPredecidos = miPredCount >= partidosCount && partidosCount > 0
  const plazoVencido = countdown ? countdown.expired : programados.length === 0 && partidosCount > 0
  const urgente = countdown && !countdown.expired && countdown.urgent && !todosPredecidos && semana

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '24px 16px 100px' }}>

      {/* Onboarding */}
      {showOnboarding && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px', zIndex: 1000,
        }}>
          <div className="card" style={{ maxWidth: '360px', width: '100%', textAlign: 'center' }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '14px',
              background: 'linear-gradient(135deg, var(--verde), var(--verde-dark))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px', boxShadow: '0 0 28px var(--verde-glow)',
            }}>
              <span style={{ fontSize: '28px', lineHeight: 1 }}>⚽</span>
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '20px' }}>Bienvenido a TraxallBets</h2>
            <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
              {[
                ['🎯', 'Adivina el marcador exacto', 'de los partidos de Barça y Real Madrid cada semana'],
                ['💰', 'Apuesta 5€ por semana', 'si eres el único en acertar los dos marcadores exactos, te llevas el bote'],
                ['🚫', 'Sin combinados repetidos', 'no puedes tener el mismo pronóstico que otro jugador — sé original'],
              ].map(([icon, title, desc]) => (
                <div key={title} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '20px', lineHeight: 1.4, flexShrink: 0 }}>{icon}</span>
                  <div>
                    <p style={{ fontWeight: '600', fontSize: '14px', marginBottom: '2px' }}>{title}</p>
                    <p style={{ fontSize: '13px', color: 'var(--text2)', lineHeight: 1.5 }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <button className="btn btn-primary" style={{ width: '100%', padding: '12px' }} onClick={dismissOnboarding}>
              ¡Empecemos!
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700', letterSpacing: '-0.02em' }}>
          Hola, {profile?.username}
        </h1>
        <p style={{ color: 'var(--text2)', marginTop: '4px', fontSize: '14px' }}>
          {semana ? `Semana ${semana.numero} en juego` : 'Esperando nueva semana'}
        </p>
      </div>

      {/* Banner urgente */}
      {urgente && (
        <div className="alert alert-error" style={{ marginBottom: '16px', alignItems: 'center' }}>
          <Flame size={16} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: '700', marginBottom: '2px' }}>¡Cierra pronto!</p>
            <p style={{ fontSize: '12px', opacity: 0.9, fontFamily: 'var(--mono)' }}>
              {countdown.horas > 0 ? `${countdown.horas}h ` : ''}{String(countdown.minutos).padStart(2, '0')}m {String(countdown.segundos).padStart(2, '0')}s
            </p>
          </div>
          <Link to="/predicciones" style={{ flexShrink: 0 }}>
            <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '12px' }}>Apostar</button>
          </Link>
        </div>
      )}

      {/* Última semana resuelta (solo cuando no hay semana activa) */}
      {!semana && lastResolved && (
        <div className="card" style={{
          marginBottom: '16px', textAlign: 'center',
          background: lastResolved.ganador_id
            ? 'linear-gradient(135deg, #1a2f00, #243800)'
            : 'linear-gradient(135deg, #1a1500, #2a2000)',
          border: `1px solid ${lastResolved.ganador_id ? 'rgba(0,200,83,0.3)' : 'rgba(255,200,0,0.25)'}`,
        }}>
          {lastResolved.ganador_id ? (
            <>
              <Trophy size={28} color="var(--amarillo)" style={{ marginBottom: '10px' }} />
              <p style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Semana {lastResolved.numero} — Ganador
              </p>
              <p style={{ fontSize: '22px', fontWeight: '700', marginBottom: '6px' }}>
                🏆 {lastResolved.ganador?.username}
              </p>
              <p style={{ fontSize: '36px', fontWeight: '700', fontFamily: 'var(--mono)', color: 'var(--verde)' }}>
                +{lastResolved.bote_euros}€
              </p>
            </>
          ) : (
            <>
              <p style={{ fontSize: '36px', marginBottom: '8px' }}>🤷</p>
              <p style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Semana {lastResolved.numero}
              </p>
              <p style={{ fontSize: '16px', fontWeight: '700', marginBottom: '8px' }}>
                Nadie acertó los dos marcadores exactos
              </p>
              <p style={{ fontSize: '13px', color: 'var(--amarillo)' }}>
                El bote de <strong style={{ fontFamily: 'var(--mono)' }}>{lastResolved.bote_euros}€</strong> se acumula a la siguiente semana
              </p>
            </>
          )}
        </div>
      )}

      {/* Bote actual */}
      {semana && (
        <div className="card" style={{
          background: 'linear-gradient(135deg, #0f2a1a, #1a3a28)',
          border: '1px solid rgba(0,200,83,0.2)',
          marginBottom: '16px',
          textAlign: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '8px' }}>
            <Wallet size={13} color="var(--verde)" />
            <p style={{ color: 'var(--verde)', fontSize: '12px', fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase' }}>
              Bote acumulado
            </p>
          </div>
          <p style={{ fontSize: '52px', fontWeight: '700', fontFamily: 'var(--mono)', color: '#fff', lineHeight: 1 }}>
            {semana.bote_euros}€
          </p>
          <p style={{ color: 'var(--text2)', fontSize: '13px', marginTop: '10px' }}>
            Semana {semana.numero} · {partidosCount} partido{partidosCount !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* Mis predicciones */}
      {semana && (
        <div className="card" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '600' }}>Mis predicciones</h3>
            <span style={{ fontSize: '13px', color: todosPredecidos ? 'var(--verde)' : 'var(--amarillo)', fontWeight: '600' }}>
              {miPredCount}/{partidosCount}
            </span>
          </div>

          {partidos.length === 0 ? (
            <p style={{ color: 'var(--text2)', fontSize: '14px' }}>Cargando partidos...</p>
          ) : partidos.map((partido, i) => {
            const pred = misPredicciones.find(p => p.partido_id === partido.id)
            const fechaStr = format(new Date(partido.fecha_partido), "EEE d MMM, HH:mm", { locale: es })
            return (
              <div key={partido.id} style={{
                padding: '12px 0',
                borderBottom: i < partidos.length - 1 ? '1px solid var(--border)' : 'none',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: '600', marginBottom: '3px' }}>
                    {partido.equipo_local} vs {partido.equipo_visitante}
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--text2)' }}>{fechaStr}</p>
                </div>
                {pred ? (
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: '18px', fontWeight: '700', color: 'var(--verde)' }}>
                      {pred.goles_local_prediccion} – {pred.goles_visitante_prediccion}
                    </span>
                    {pred.es_correcto !== null && (
                      <div style={{ marginTop: '4px' }}>
                        <span className={`badge badge-${pred.es_correcto ? 'verde' : 'rojo'}`}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          {pred.es_correcto
                            ? <><Check size={10} strokeWidth={3} /> Acertado</>
                            : <><X size={10} strokeWidth={3} /> Fallado</>}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="badge badge-amarillo">Sin pred.</span>
                )}
              </div>
            )
          })}

          {/* Countdown */}
          {countdown && !countdown.expired && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '14px', justifyContent: 'center' }}>
              <Clock size={13} color={countdown.urgent ? 'var(--rojo)' : 'var(--amarillo)'} />
              <p style={{
                fontSize: '13px', fontFamily: 'var(--mono)', fontWeight: '600',
                color: countdown.urgent ? 'var(--rojo)' : 'var(--amarillo)',
              }}>
                {countdown.horas > 0 ? `${countdown.horas}h ` : ''}{String(countdown.minutos).padStart(2, '0')}m {String(countdown.segundos).padStart(2, '0')}s
              </p>
            </div>
          )}
          {plazoVencido && programados.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '14px', justifyContent: 'center' }}>
              <Lock size={13} color="var(--rojo)" />
              <p style={{ fontSize: '12px', color: 'var(--rojo)' }}>Plazo cerrado</p>
            </div>
          )}

          {!todosPredecidos && partidosCount > 0 && !plazoVencido && (
            <Link to="/predicciones" style={{ display: 'block', marginTop: '16px' }}>
              <button className="btn btn-primary" style={{ width: '100%' }}>
                <PenLine size={15} />
                <span>Poner mis predicciones</span>
              </button>
            </Link>
          )}

          {todosPredecidos && !plazoVencido && (
            <button className="btn btn-ghost" style={{ width: '100%', marginTop: '12px' }} onClick={shareWhatsApp}>
              <Share2 size={14} />
              <span>Compartir por WhatsApp</span>
            </button>
          )}
        </div>
      )}

      {/* Participantes */}
      {semana && (
        <div className="card" style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Users size={16} color="var(--text2)" />
            <h3 style={{ fontSize: '15px', fontWeight: '600' }}>Participantes</h3>
            {participantes.length > 0 && (
              <span style={{ fontSize: '13px', color: 'var(--text3)', marginLeft: 'auto' }}>
                {participantes.filter(p => p.pagado).length}/{participantes.length} pagados
              </span>
            )}
          </div>
          {participantes.length === 0 ? (
            <p style={{ color: 'var(--text2)', fontSize: '14px' }}>Nadie ha enviado su apuesta aún</p>
          ) : participantes.map((p, i) => (
            <div key={p.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 0',
              borderBottom: i < participantes.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              <span style={{ fontSize: '14px', fontWeight: profile?.id === p.user_id ? '700' : '400' }}>
                {p.profiles?.username}{profile?.id === p.user_id ? ' (tú)' : ''}
              </span>
              {p.pagado ? (
                <span className="badge badge-verde" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                  <Check size={10} strokeWidth={3} /> Confirmado
                </span>
              ) : (
                <span className="badge badge-amarillo" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                  <Clock size={10} /> Pendiente
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Ranking histórico */}
      {ranking.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <Trophy size={16} color="var(--amarillo)" />
            <h3 style={{ fontSize: '15px', fontWeight: '600' }}>Ranking histórico</h3>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '16px' }}>
            +1 por cada marcador exacto acertado, aunque no te lleves el bote
          </p>
          {ranking.map((r, i) => (
            <div key={r.username} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 0',
              borderBottom: i < ranking.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{
                  width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                  background: i === 0 ? 'var(--amarillo)' : i === 1 ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.07)',
                  color: i === 0 ? '#000' : 'var(--text)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '12px', fontWeight: '700',
                }}>
                  {i + 1}
                </span>
                <span style={{ fontSize: '15px', fontWeight: profile?.username === r.username ? '700' : '400' }}>
                  {r.username}{profile?.username === r.username ? ' (tú)' : ''}
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

      {!semana && !loading && !lastResolved && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '50%',
            background: 'var(--bg4)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', margin: '0 auto 16px',
          }}>
            <Clock size={22} color="var(--text3)" />
          </div>
          <p style={{ fontWeight: '600', marginBottom: '6px' }}>Sin semana activa</p>
          <p style={{ color: 'var(--text2)', fontSize: '13px' }}>El administrador creará una nueva semana pronto</p>
        </div>
      )}
    </div>
  )
}
