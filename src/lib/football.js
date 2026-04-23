// football-data.org API helper
// Team IDs: FC Barcelona = 81, Real Madrid = 86
// Competition: La Liga = PD

const API_KEY = import.meta.env.VITE_FOOTBALL_API_KEY
const BASE_URL = 'https://api.football-data.org/v4'
const BARCA_ID = 81
const MADRID_ID = 86
const LALIGA_ID = 'PD'

const headers = {
  'X-Auth-Token': API_KEY,
}

export async function getUpcomingMatches() {
  const today = new Date()
  const in14days = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000)
  const dateFrom = today.toISOString().split('T')[0]
  const dateTo = in14days.toISOString().split('T')[0]

  const res = await fetch(
    `${BASE_URL}/competitions/${LALIGA_ID}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}&status=SCHEDULED`,
    { headers }
  )
  const data = await res.json()
  
  return (data.matches || []).filter(
    m => m.homeTeam.id === BARCA_ID || m.awayTeam.id === BARCA_ID ||
         m.homeTeam.id === MADRID_ID || m.awayTeam.id === MADRID_ID
  )
}

export async function getMatchResult(matchId) {
  const res = await fetch(`${BASE_URL}/matches/${matchId}`, { headers })
  const data = await res.json()
  return data.match || data
}

export async function getCurrentWeekMatches() {
  // Get matches for the current matchday
  const res = await fetch(
    `${BASE_URL}/competitions/${LALIGA_ID}/matches?status=SCHEDULED,IN_PLAY,FINISHED`,
    { headers }
  )
  const data = await res.json()
  const matches = (data.matches || []).filter(
    m => m.homeTeam.id === BARCA_ID || m.awayTeam.id === BARCA_ID ||
         m.homeTeam.id === MADRID_ID || m.awayTeam.id === MADRID_ID
  )
  
  // Return the closest upcoming or most recent
  const upcoming = matches.filter(m => m.status === 'SCHEDULED' || m.status === 'IN_PLAY')
  if (upcoming.length > 0) return upcoming.slice(0, 2)
  
  const finished = matches.filter(m => m.status === 'FINISHED')
  return finished.slice(-2)
}

export function getTeamName(match, teamId) {
  if (match.homeTeam?.id === teamId) return match.homeTeam.shortName || match.homeTeam.name
  if (match.awayTeam?.id === teamId) return match.awayTeam.shortName || match.awayTeam.name
  return null
}

export function formatMatch(match) {
  return {
    id: match.id,
    homeTeam: match.homeTeam?.shortName || match.homeTeam?.name,
    awayTeam: match.awayTeam?.shortName || match.awayTeam?.name,
    homeTeamId: match.homeTeam?.id,
    awayTeamId: match.awayTeam?.id,
    utcDate: match.utcDate,
    status: match.status,
    homeScore: match.score?.fullTime?.home ?? null,
    awayScore: match.score?.fullTime?.away ?? null,
    matchday: match.matchday,
    isBarca: match.homeTeam?.id === BARCA_ID || match.awayTeam?.id === BARCA_ID,
    isMadrid: match.homeTeam?.id === MADRID_ID || match.awayTeam?.id === MADRID_ID,
  }
}

export { BARCA_ID, MADRID_ID }
