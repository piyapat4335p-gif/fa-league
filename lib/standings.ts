import type { Match, Player, Standing } from './types.ts';

export const scoring = { win: 3, draw: 1, loss: 0 };
export const tieBreakers: (keyof Pick<Standing, 'points' | 'gd' | 'gf'>)[] = ['points', 'gd', 'gf'];
export function compareStandings(a: Standing, b: Standing) {
  for (const key of tieBreakers) { if (a[key] !== b[key]) return b[key] - a[key]; }
  return a.player_name.localeCompare(b.player_name, 'th');
}
export function calculateStandings(players: Player[], matches: Match[]): Standing[] {
  const rows = new Map(players.map(p => [p.id, { ...p, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0, form: [] } as Standing]));
  for (const match of [...matches].sort((a, b) => a.played_at.localeCompare(b.played_at) || a.id.localeCompare(b.id))) {
    const home = rows.get(match.home_player_id), away = rows.get(match.away_player_id);
    if (!home || !away || home.id === away.id || home.season_id !== match.season_id || away.season_id !== match.season_id) continue;
    if (!Number.isInteger(match.home_score) || !Number.isInteger(match.away_score) || match.home_score < 0 || match.away_score < 0) continue;
    for (const [row, gf, ga] of [[home, match.home_score, match.away_score], [away, match.away_score, match.home_score]] as const) {
      row.played++; row.gf += gf; row.ga += ga; row.gd = row.gf - row.ga;
      if (gf > ga) { row.won++; row.points += scoring.win; row.form.push('W'); }
      else if (gf === ga) { row.drawn++; row.points += scoring.draw; row.form.push('D'); }
      else { row.lost++; row.points += scoring.loss; row.form.push('L'); }
      row.form = row.form.slice(-5);
    }
  }
  return [...rows.values()].sort(compareStandings);
}
export function pointsProgression(players: Player[], matches: Match[]) {
  const sorted = [...matches].sort((a, b) => a.played_at.localeCompare(b.played_at) || a.id.localeCompare(b.id));
  return players.map(player => {
    const points = [0];
    for (const match of sorted.filter(m => m.season_id === player.season_id && (m.home_player_id === player.id || m.away_player_id === player.id))) {
      const home = match.home_player_id === player.id;
      const gf = home ? match.home_score : match.away_score, ga = home ? match.away_score : match.home_score;
      points.push(points.at(-1)! + (gf > ga ? scoring.win : gf === ga ? scoring.draw : scoring.loss));
    }
    return { player, points };
  });
}
export function validateMatch(match: Pick<Match, 'home_player_id' | 'away_player_id' | 'home_score' | 'away_score' | 'played_at'>) {
  if (!match.home_player_id || !match.away_player_id) return 'กรุณาเลือกผู้เล่นทั้งสองฝั่ง';
  if (match.home_player_id === match.away_player_id) return 'ต้องเลือกผู้เล่นคนละคน';
  if (![match.home_score, match.away_score].every(s => Number.isInteger(s) && s >= 0 && s <= 99)) return 'สกอร์ต้องเป็นจำนวนเต็มตั้งแต่ 0 ถึง 99';
  if (!Number.isFinite(Date.parse(match.played_at))) return 'กรุณาเลือกวันและเวลาแข่งขัน';
  return null;
}
