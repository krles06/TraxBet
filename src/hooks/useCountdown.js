import { useEffect, useState } from 'react'

export function useCountdown(targetDate) {
  function calc() {
    if (!targetDate) return null
    const diff = new Date(targetDate) - Date.now()
    if (diff <= 0) return { expired: true, horas: 0, minutos: 0, segundos: 0, urgent: false }
    return {
      expired: false,
      horas: Math.floor(diff / 3600000),
      minutos: Math.floor((diff % 3600000) / 60000),
      segundos: Math.floor((diff % 60000) / 1000),
      urgent: diff < 6 * 3600000,
    }
  }

  const [t, setT] = useState(calc)

  useEffect(() => {
    if (!targetDate) return
    setT(calc())
    const id = setInterval(() => setT(calc()), 1000)
    return () => clearInterval(id)
  }, [String(targetDate)])

  return t
}
