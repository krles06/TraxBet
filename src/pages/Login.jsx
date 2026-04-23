import { useState } from 'react'
import { Link } from 'react-router-dom'
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
      justifyContent: 'center', padding: '24px'
    }}>
      <div style={{ width: '100%', maxWidth: '380px' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>⚽</div>
          <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px' }}>Porra Fútbol</h1>
          <p style={{ color: 'var(--text2)', fontSize: '15px' }}>Barça vs Madrid — ¿Quién acierta?</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text2)' }}>Email</label>
              <input className="input" type="email" value={email}
                onChange={e => setEmail(e.target.value)} required placeholder="tu@email.com" />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text2)' }}>Contraseña</label>
              <input className="input" type="password" value={password}
                onChange={e => setPassword(e.target.value)} required placeholder="••••••••" />
            </div>
            {error && (
              <p style={{ color: 'var(--rojo)', fontSize: '13px', background: 'rgba(255,61,61,0.1)', padding: '10px', borderRadius: '8px' }}>
                {error}
              </p>
            )}
            <button className="btn btn-primary" type="submit" disabled={loading}
              style={{ width: '100%', padding: '12px' }}>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: '20px', color: 'var(--text2)', fontSize: '14px' }}>
          ¿No tienes cuenta? <Link to="/register" style={{ color: 'var(--verde)', fontWeight: '600' }}>Regístrate</Link>
        </p>
      </div>
    </div>
  )
}
