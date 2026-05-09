import { NavLink } from 'react-router-dom'
import { Home, PenLine, BarChart2, User, MessageCircle } from 'lucide-react'

const links = [
  { to: '/', icon: Home, label: 'Inicio' },
  { to: '/predicciones', icon: PenLine, label: 'Predecir' },
  { to: '/resultados', icon: BarChart2, label: 'Resultados' },
  { to: '/chat', icon: MessageCircle, label: 'Chat' },
  { to: '/perfil', icon: User, label: 'Perfil' },
]

export default function Nav() {
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
      background: 'rgba(10,10,13,0.88)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderTop: '1px solid var(--border-med)',
      display: 'flex',
      justifyContent: 'space-around',
      padding: '6px 0 calc(6px + env(safe-area-inset-bottom))',
    }}>
      {links.map(({ to, icon: Icon, label }) => (
        <NavLink key={to} to={to} end={to === '/'} style={({ isActive }) => ({
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
          padding: '8px 20px', borderRadius: 'var(--radius-sm)',
          color: isActive ? 'var(--verde)' : 'var(--text3)',
          transition: 'color 0.15s',
          minWidth: '60px',
        })}>
          {({ isActive }) => (
            <>
              <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
              <span style={{
                fontSize: '10px',
                fontWeight: isActive ? 700 : 500,
                letterSpacing: '0.02em',
              }}>
                {label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
