// Vercel serverless function — proxy para football-data.org
// Evita el error de CORS en producción
export default async function handler(req, res) {
  const API_KEY = process.env.VITE_FOOTBALL_API_KEY
  const { type } = req.query

  const today = new Date()
  let url

  if (type === 'upcoming') {
    const in21days = new Date(today.getTime() + 21 * 24 * 60 * 60 * 1000)
    const dateFrom = today.toISOString().split('T')[0]
    const dateTo = in21days.toISOString().split('T')[0]
    url = `https://api.football-data.org/v4/competitions/PD/matches?dateFrom=${dateFrom}&dateTo=${dateTo}&status=SCHEDULED`
  } else if (type === 'finished') {
    url = `https://api.football-data.org/v4/competitions/PD/matches?status=FINISHED`
  } else {
    return res.status(400).json({ error: 'Parámetro type inválido. Usa: upcoming | finished' })
  }

  try {
    const response = await fetch(url, { headers: { 'X-Auth-Token': API_KEY } })
    const data = await response.json()
    res.status(200).json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
