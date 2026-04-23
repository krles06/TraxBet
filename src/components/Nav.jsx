import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: '🏠', title: 'Inicio' },
  { to: '/predicciones', label: '✏️', title: 'Predecir' },
  { to: '/resultados', label: '📊', title: 'Resultados' },
  { to: '/perfil', label: '👤', title: 'Perfil' },
]

export default function Nav() {
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
      background: 'rgba(10,10,15,0.95)', backdropFilter: 'blur(12px)',
      borderTop: '1px solid var(--border)',
      display: 'flex', justifyContent: 'space-around', padding: '8px 0 12px',
    }}>
      {links.map(l => (
        <NavLink key={l.to} to={l.to} end={l.to === '/'} style={({ isActive }) => ({
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
          padding: '6px 16px', borderRadius: '8px',
          color: isActive ? 'var(--verde)' : 'var(--text2)',
          transition: 'color 0.15s',
          fontSize: '20px',
        })}>
          <span>{l.label}</span>
          <span style={{ fontSize: '10px', fontWeight: '600' }}>{l.title}</span>
        </NavLink>
      ))}
    </nav>
  )
}
