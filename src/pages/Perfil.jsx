import { useState } from 'react'
import { useAuth } from '../hooks/useAuth.jsx'

export default function Perfil() {
  const { profile, updateProfile, signOut } = useAuth()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    setSaving(true)
    setError('')

    const { error: updateError } = await updateProfile({
      // add other profile fields here if needed in the future
    })

    if (updateError) setError(updateError.message)
    else setSaved(true)
    setSaving(false)
    setTimeout(() => setSaved(false), 2000)
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
          <p style={{ fontSize: '13px', color: 'var(--text2)' }}>Participante de la porra ⚽</p>
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
