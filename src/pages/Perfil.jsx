import { useState } from 'react'
import { useAuth } from '../hooks/useAuth.jsx'
import { User, Mail, Phone, Save, LogOut, Check, AlertCircle } from 'lucide-react'

export default function Perfil() {
  const { user, profile, updateProfile, signOut } = useAuth()
  const [username, setUsername] = useState(profile?.username || '')
  const [phone, setPhone] = useState(profile?.phone || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!username.trim()) { setError('El nombre no puede estar vacío'); return }
    if (username.trim().length < 3) { setError('Mínimo 3 caracteres'); return }
    setSaving(true)
    setError('')

    const { error: updateError } = await updateProfile({
      username: username.trim(),
      phone: phone.trim() || null,
    })

    if (updateError) setError(updateError.message)
    else { setSaved(true); setTimeout(() => setSaved(false), 2500) }
    setSaving(false)
  }

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '24px 16px 100px' }}>
      <h1 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '28px', letterSpacing: '-0.02em' }}>Mi perfil</h1>

      {/* Avatar + datos */}
      <div className="card" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{
          width: '52px', height: '52px', borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg, var(--verde), #00796b)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '20px', fontWeight: '700', color: '#000',
        }}>
          {profile?.username?.[0]?.toUpperCase()}
        </div>
        <div>
          <p style={{ fontSize: '17px', fontWeight: '700', marginBottom: '3px' }}>{profile?.username}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Mail size={12} color="var(--text3)" />
            <p style={{ fontSize: '13px', color: 'var(--text2)' }}>{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Editar perfil */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px' }}>Editar perfil</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label className="label">Nombre visible en el ranking</label>
            <div style={{ position: 'relative' }}>
              <User size={15} style={{
                position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)',
                color: 'var(--text3)', pointerEvents: 'none',
              }} />
              <input
                className="input"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                minLength={3}
                maxLength={20}
                placeholder="Tu nombre o apodo"
                style={{ paddingLeft: '36px' }}
              />
            </div>
          </div>
          <div>
            <label className="label">
              Teléfono <span style={{ color: 'var(--text3)', fontWeight: '400' }}>(opcional)</span>
            </label>
            <div style={{ position: 'relative' }}>
              <Phone size={15} style={{
                position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)',
                color: 'var(--text3)', pointerEvents: 'none',
              }} />
              <input
                className="input"
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+34 600 000 000"
                style={{ paddingLeft: '36px' }}
              />
            </div>
          </div>

          {error && (
            <div className="alert alert-error">
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span>{error}</span>
            </div>
          )}

          <button
            className={`btn ${saved ? 'btn-secondary' : 'btn-primary'}`}
            style={{ width: '100%' }}
            onClick={handleSave}
            disabled={saving}
          >
            {saved
              ? <><Check size={15} strokeWidth={2.5} /><span>Guardado</span></>
              : saving
              ? 'Guardando...'
              : <><Save size={15} /><span>Guardar cambios</span></>}
          </button>
        </div>
      </div>

      {/* Cerrar sesión */}
      <button
        className="btn btn-ghost"
        style={{ width: '100%', color: 'var(--rojo)', borderColor: 'rgba(255,68,68,0.2)' }}
        onClick={signOut}
      >
        <LogOut size={15} />
        <span>Cerrar sesión</span>
      </button>
    </div>
  )
}
