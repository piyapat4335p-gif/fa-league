export type Season = { id: string; name: string; is_active: boolean; created_at?: string };
export type Player = { id: string; season_id: string; user_id?: string | null; player_name: string; team_name: string };
export type Match = { id: string; season_id: string; home_player_id: string; away_player_id: string; home_score: number; away_score: number; played_at: string; created_by?: string | null; created_at?: string; updated_at?: string };
export type HistoricalStanding = { season_id: string; player_id: string; played: number; won: number; drawn: number; lost: number; gf: number; ga: number; points: number };
export type PlayerFee = { player_id: string; paid: boolean; note: string; updated_at?: string };
export type LeagueData = { seasons: Season[]; players: Player[]; matches: Match[]; historicalStandings: HistoricalStanding[] };
export type Standing = Player & { played: number; won: number; drawn: number; lost: number; gf: number; ga: number; gd: number; points: number; form: ('W' | 'D' | 'L')[] };
export type Profile = { id: string; display_name: string; role: 'admin' | 'player' };
