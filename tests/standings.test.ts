import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateStandings, pointsProgression, validateHomeAwaySchedule, validateMatch } from '../lib/standings.ts';
import { demoData } from '../lib/demo.ts';
import type { Match, Player } from '../lib/types.ts';
const players: Player[] = ['a','b','c'].map(id => ({id, season_id:'s', player_name:id, team_name:id}));
const match = (id: string, home: string, away: string, h: number, a: number): Match => ({id, season_id:'s', home_player_id:home, away_player_id:away, home_score:h, away_score:a, played_at:`2026-09-${id.padStart(2,'0')}T12:00:00Z`});
test('wins, draws, away wins and goal difference are calculated from results', () => {
  const rows = calculateStandings(players, [match('1','a','b',2,0), match('2','b','c',1,1), match('3','a','c',0,3)]);
  assert.deepEqual(rows.map(r=>[r.id,r.played,r.won,r.drawn,r.lost,r.gf,r.ga,r.gd,r.points]), [['c',2,1,1,0,4,1,3,4],['a',2,1,0,1,2,3,-1,3],['b',2,0,1,1,1,3,-2,1]]);
});
test('tie-breaks use goal difference then goals scored', () => {
  const rows = calculateStandings(players, [match('1','a','b',1,0), match('2','b','c',3,0), match('3','c','a',2,1)]);
  assert.deepEqual(rows.map(r=>r.id), ['b','a','c']);
  const draws = calculateStandings(players,[match('1','a','b',0,0),match('2','b','c',2,2),match('3','c','a',1,1)]);
  assert.deepEqual(draws.map(r=>r.id),['c','b','a']);
});
test('empty season includes players and malformed/cross-season results do not affect standings', () => {
  assert.equal(calculateStandings(players,[])[0].points,0);
  assert.equal(calculateStandings(players,[{...match('1','a','b',2,0),season_id:'other'},match('2','a','a',2,1),match('3','a','b',-1,0)])[0].played,0);
});
test('editing and deleting a match changes points without stored totals', () => {
  const original = match('1','a','b',1,0);
  assert.equal(calculateStandings(players,[original])[0].id,'a');
  assert.equal(calculateStandings(players,[{...original,home_score:0,away_score:2}])[0].id,'b');
  assert.ok(calculateStandings(players,[]).every(r=>r.points===0));
});
test('progression and sample totals agree with standings', () => {
  const rows=calculateStandings(demoData.players,demoData.matches);
  assert.equal(rows.reduce((s,p)=>s+p.played,0),demoData.matches.length*2);
  assert.equal(rows.reduce((s,p)=>s+p.gf,0),rows.reduce((s,p)=>s+p.ga,0));
  for (const s of pointsProgression(demoData.players,demoData.matches)) assert.equal(s.points.at(-1),rows.find(p=>p.id===s.player.id)?.points);
});
test('invalid scores, duplicate player and missing date are rejected', () => {
  const good=match('1','a','b',0,0);
  assert.equal(validateMatch(good),null);
  for(const change of [{home_score:-1},{home_score:1.5},{away_score:100},{away_player_id:'a'},{played_at:''}]) assert.ok(validateMatch({...good,...change}));
});
test('a pair can play once at each home ground and no third match', () => {
  const first = match('1','a','b',1,0);
  const reverse = match('2','b','a',0,1);
  assert.equal(validateHomeAwaySchedule([], first), null);
  assert.match(validateHomeAwaySchedule([first], match('3','a','b',2,0))!, /สลับเหย้า/);
  assert.equal(validateHomeAwaySchedule([first], reverse), null);
  assert.match(validateHomeAwaySchedule([first, reverse], match('3','a','b',2,0))!, /ครบ 2 นัด/);
  assert.equal(validateHomeAwaySchedule([first, reverse], { id: first.id, home_player_id: first.home_player_id, away_player_id: first.away_player_id }), null);
});
