import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react'
import { useAuth } from '../hooks/useAuth.jsx'

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: signInError } = await signIn(email, password)
    if (signInError) setError(signInError.message)
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: '24px',
      background: 'radial-gradient(ellipse at top, rgba(0,200,83,0.04) 0%, transparent 60%), var(--bg)',
    }}>
      <div style={{ width: '100%', maxWidth: '360px' }}>

        {/* Marca */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{
            width: '52px', height: '52px', borderRadius: '14px',
            background: 'linear-gradient(135deg, var(--verde), var(--verde-dark))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 18px',
            boxShadow: '0 0 28px var(--verde-glow)',
          }}>
            <span style={{ fontSize: '26px', lineHeight: 1 }}>⚽</span>
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: '700', marginBottom: '6px', letterSpacing: '-0.02em' }}>
            Porra Fútbol
          </h1>
          <p style={{ color: 'var(--text2)', fontSize: '14px' }}>
            Barça · Madrid — ¿Quién acierta el marcador?
          </p>
        </div>

        {/* Formulario */}
        <div className="card" style={{ boxShadow: 'var(--shadow-lg)' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label className="label">Email</label>
              <div style={{ position: 'relative' }}>
                <Mail size={15} style={{
                  position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--text3)', pointerEvents: 'none',
                }} />
                <input className="input" type="email" value={email}
                  onChange={e => setEmail(e.target.value)} required
                  placeholder="tu@email.com"
                  style={{ paddingLeft: '36px' }} />
              </div>
            </div>
            <div>
              <label className="label">Contraseña</label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} style={{
                  position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--text3)', pointerEvents: 'none',
                }} />
                <input className="input" type="password" value={password}
                  onChange={e => setPassword(e.target.value)} required
                  placeholder="••••••••"
                  style={{ paddingLeft: '36px' }} />
              </div>
            </div>

            {error && (
              <div className="alert alert-error">
                <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
                <span>{error}</span>
              </div>
            )}

            <button className="btn btn-primary" type="submit" disabled={loading}
              style={{ width: '100%', padding: '12px', marginTop: '4px' }}>
              {loading ? 'Entrando...' : (
                <><span>Entrar</span><ArrowRight size={16} /></>
              )}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: '20px', color: 'var(--text2)', fontSize: '14px' }}>
          ¿No tienes cuenta?{' '}
          <Link to="/register" style={{ color: 'var(--verde)', fontWeight: '600' }}>Regístrate</Link>
        </p>
      </div>
    </div>
  )
}
