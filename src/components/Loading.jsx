export default function Loading() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', flexDirection: 'column', gap: '16px'
    }}>
      <div style={{
        width: '40px', height: '40px', borderRadius: '50%',
        border: '3px solid rgba(255,255,255,0.1)',
        borderTopColor: 'var(--verde)',
        animation: 'spin 0.8s linear infinite'
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
