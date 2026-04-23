import { useState } from 'react'
import { useAuth } from '../hooks/useAuth.jsx'

export default function Perfil() {
  const { user, profile, updateProfile, signOut } = useAuth()
  const [username, setUsername] = useState(profile?.username || '')
  const [phone, setPhone] = useState(profile?.phone || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    if (!username.trim()) { setError('El nombre no puede estar vacío'); return }
    if (username.trim().length < 3) { setError('El nombre debe tener al menos 3 caracteres'); return }
    setSaving(true)
    setError('')

    const { error: updateError } = await updateProfile({
      username: username.trim(),
      phone: phone.trim() || null,
    })

    if (updateError) setError(updateError.message)
    else { setSaved(true); setTimeout(() => setSaved(false), 2000) }
    setSaving(false)
  }

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '28px' }}>👤 Mi perfil</h1>

      {/* Info usuario */}
      <div className="card" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{
          width: '52px', height: '52px', borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--verde), #00796b)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '22px', fontWeight: '700', color: '#000',
          flexShrink: 0,
        }}>
          {profile?.username?.[0]?.toUpperCase()}
        </div>
        <div>
          <p style={{ fontSize: '18px', fontWeight: '700' }}>{profile?.username}</p>
          <p style={{ fontSize: '13px', color: 'var(--text2)' }}>{user?.email}</p>
        </div>
      </div>

      {/* Editar perfil */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px' }}>Editar perfil</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text2)' }}>
              Nombre visible en el ranking
            </label>
            <input
              className="input"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              minLength={3}
              maxLength={20}
              placeholder="Tu nombre o apodo"
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text2)' }}>
              Teléfono <span style={{ color: 'var(--text3)' }}>(opcional)</span>
            </label>
            <input
              className="input"
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+34 600 000 000"
            />
          </div>
          {error && (
            <p style={{ color: 'var(--rojo)', fontSize: '13px', background: 'rgba(255,61,61,0.1)', padding: '10px', borderRadius: '8px' }}>
              {error}
            </p>
          )}
          <button
            className={`btn ${saved ? 'btn-secondary' : 'btn-primary'}`}
            style={{ width: '100%' }}
            onClick={handleSave}
            disabled={saving}
          >
            {saved ? '✓ Guardado' : saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      {/* Cerrar sesión */}
      <button
        className="btn btn-secondary"
        style={{ width: '100%', color: 'var(--rojo)', borderColor: 'rgba(255,61,61,0.2)' }}
        onClick={signOut}
      >
        Cerrar sesión
      </button>
    </div>
  )
}
