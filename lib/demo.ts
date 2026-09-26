import type { LeagueData } from './types.ts';
const seasonId = '00000000-0000-4000-8000-000000000020';
const names = [['Ta', 'Gunner'], ['Nicky', 'Udon FC'], ['คิคุง', 'TikungShow2'], ['Nice', 'HumNoiy'], ['กร', 'Korn'], ['Pok', 'PokkyShow'], ['OB', 'Sakamoto']];
const players = names.map(([player_name, team_name], i) => ({ id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, season_id: seasonId, player_name, team_name }));
const fixtures = [[0,1,3,1],[2,3,2,0],[4,5,1,1],[6,0,0,2],[1,2,2,2],[3,4,3,0],[5,6,1,0],[0,2,2,1],[1,3,1,0],[4,6,2,1],[0,3,3,0],[2,5,2,0],[1,4,2,1],[3,6,1,1],[0,4,1,0],[5,1,0,2],[6,2,1,3],[3,5,2,0],[4,2,1,2],[0,5,4,1],[1,6,2,0],[2,0,1,1],[4,3,0,1],[6,5,0,1],[3,1,1,1],[2,1,0,2],[5,4,1,2],[6,0,0,3],[0,1,2,2],[2,3,3,1]];
export const demoData: LeagueData = {
  seasons: [{ id: seasonId, name: 'FA League 20', is_active: true }], players,
  matches: fixtures.map(([h,a,hs,as], i) => ({ id: `10000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, season_id: seasonId, home_player_id: players[h].id, away_player_id: players[a].id, home_score: hs, away_score: as, played_at: new Date(Date.UTC(2026, 8, 10 + Math.floor(i / 3), 11, i % 3 * 20)).toISOString() })),
  historicalStandings: [],
};
