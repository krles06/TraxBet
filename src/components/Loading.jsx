export default function Loading() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', flexDirection: 'column', gap: '14px',
    }}>
      <div style={{
        width: '36px', height: '36px', borderRadius: '50%',
        border: '2.5px solid var(--bg4)',
        borderTopColor: 'var(--verde)',
        animation: 'spin 0.7s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <span style={{ fontSize: '13px', color: 'var(--text3)', letterSpacing: '0.04em' }}>
        Cargando
      </span>
    </div>
  )
}
