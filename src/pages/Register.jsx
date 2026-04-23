import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'

export default function Register() {
  const { signUp } = useAuth()
  const [form, setForm] = useState({ username: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: signUpError } = await signUp(form.email, form.password, form.username)
    if (signUpError) setError(signUpError.message)
    else setSuccess(true)
    setLoading(false)
  }

  if (success) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ textAlign: 'center', maxWidth: '380px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
        <h2 style={{ marginBottom: '12px' }}>¡Casi listo!</h2>
        <p style={{ color: 'var(--text2)' }}>Revisa tu email para confirmar tu cuenta y ya puedes empezar a predecir.</p>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '380px' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>⚽</div>
          <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px' }}>Únete a la porra</h1>
          <p style={{ color: 'var(--text2)', fontSize: '15px' }}>5€ por semana, gana el bote</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text2)' }}>Nombre (visible en el ranking)</label>
              <input className="input" type="text" value={form.username}
                onChange={e => setField('username', e.target.value)} required
                placeholder="Tu nombre o apodo" minLength={3} maxLength={20} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text2)' }}>Email</label>
              <input className="input" type="email" value={form.email}
                onChange={e => setField('email', e.target.value)} required placeholder="tu@email.com" />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text2)' }}>Contraseña</label>
              <input className="input" type="password" value={form.password}
                onChange={e => setField('password', e.target.value)} required
                placeholder="Mínimo 8 caracteres" minLength={8} />
            </div>
            {error && (
              <p style={{ color: 'var(--rojo)', fontSize: '13px', background: 'rgba(255,61,61,0.1)', padding: '10px', borderRadius: '8px' }}>
                {error}
              </p>
            )}
            <button className="btn btn-primary" type="submit" disabled={loading}
              style={{ width: '100%', padding: '12px' }}>
              {loading ? 'Creando cuenta...' : 'Crear cuenta'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: '20px', color: 'var(--text2)', fontSize: '14px' }}>
          ¿Ya tienes cuenta? <Link to="/login" style={{ color: 'var(--verde)', fontWeight: '600' }}>Entra aquí</Link>
        </p>
      </div>
    </div>
  )
}
