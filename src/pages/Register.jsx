import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, Lock, User, ArrowRight, AlertCircle, CheckCircle } from 'lucide-react'
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
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: '24px',
    }}>
      <div style={{ textAlign: 'center', maxWidth: '360px' }}>
        <div style={{
          width: '56px', height: '56px', borderRadius: '50%',
          background: 'var(--verde-dim)', border: '1px solid var(--verde-glow)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          <CheckCircle size={26} color="var(--verde)" />
        </div>
        <h2 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '10px' }}>¡Casi listo!</h2>
        <p style={{ color: 'var(--text2)', lineHeight: '1.6', fontSize: '14px' }}>
          Revisa tu email para confirmar la cuenta y ya puedes empezar a predecir.
        </p>
      </div>
    </div>
  )

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: '24px',
      background: 'radial-gradient(ellipse at top, rgba(0,200,83,0.04) 0%, transparent 60%), var(--bg)',
    }}>
      <div style={{ width: '100%', maxWidth: '360px' }}>

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
            Únete a la porra
          </h1>
          <p style={{ color: 'var(--text2)', fontSize: '14px' }}>5€ por semana · gana el bote</p>
        </div>

        <div className="card" style={{ boxShadow: 'var(--shadow-lg)' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label className="label">Nombre visible en el ranking</label>
              <div style={{ position: 'relative' }}>
                <User size={15} style={{
                  position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--text3)', pointerEvents: 'none',
                }} />
                <input className="input" type="text" value={form.username}
                  onChange={e => setField('username', e.target.value)} required
                  placeholder="Tu nombre o apodo"
                  minLength={3} maxLength={20}
                  style={{ paddingLeft: '36px' }} />
              </div>
            </div>
            <div>
              <label className="label">Email</label>
              <div style={{ position: 'relative' }}>
                <Mail size={15} style={{
                  position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--text3)', pointerEvents: 'none',
                }} />
                <input className="input" type="email" value={form.email}
                  onChange={e => setField('email', e.target.value)} required
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
                <input className="input" type="password" value={form.password}
                  onChange={e => setField('password', e.target.value)} required
                  placeholder="Mínimo 8 caracteres" minLength={8}
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
              {loading ? 'Creando cuenta...' : (
                <><span>Crear cuenta</span><ArrowRight size={16} /></>
              )}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: '20px', color: 'var(--text2)', fontSize: '14px' }}>
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" style={{ color: 'var(--verde)', fontWeight: '600' }}>Entra aquí</Link>
        </p>
      </div>
    </div>
  )
}
