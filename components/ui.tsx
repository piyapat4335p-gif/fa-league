'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { X, Trophy, ChevronRight, Clock3 } from 'lucide-react';
import type { Match, Player, Standing } from '@/lib/types';
import { pointsProgression } from '@/lib/standings';

export const colors = ['#1364f6', '#10a775', '#a779e9', '#f0ad28', '#f07755', '#25b8d2', '#64748b'];
export function Avatar({ name, index = 0 }: { name: string; index?: number }) {
  return <span className="player-avatar" style={{ background: `${colors[index % colors.length]}16`, color: colors[index % colors.length] }}>{name.slice(0, 2)}</span>;
}
export function Empty({ children }: { children: ReactNode }) { return <div className="empty"><Trophy size={30} /><p>{children}</p></div>; }
export function Modal({ title, children, onClose, feedback }: { title: string; children: ReactNode; onClose: () => void; feedback?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} className="modal" aria-labelledby="modal-title" onCancel={event => { event.preventDefault(); onClose(); }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}><div className="modal-header"><h2 id="modal-title">{title}</h2><button className="icon-button" aria-label="ปิด" onClick={onClose}><X size={20} /></button></div>{children}{feedback && <p className="modal-feedback" role="alert">{feedback}</p>}</dialog>;
}
export function StandingsTable({ rows, onPlayer }: { rows: Standing[]; onPlayer: (id: string) => void }) {
  if (!rows.length) return <Empty>ยังไม่มีผู้เล่นในฤดูกาลนี้</Empty>;
  const headers = [['แข่ง', 'MP'], ['ชนะ', 'W'], ['เสมอ', 'D'], ['แพ้', 'L'], ['ได้', 'GF'], ['เสีย', 'GA'], ['+/−', 'GD'], ['แต้ม', 'Pts'], ['ฟอร์ม 5 นัด', 'Form']];
  return <div className="table-scroll"><table className="standings-table"><caption className="sr-only">ตารางคะแนน เรียงตามแต้ม ผลต่างประตู และประตูได้</caption><thead><tr><th scope="col"><span className="desktop-stat">อันดับ</span><span className="mobile-stat">#</span></th><th scope="col"><span className="desktop-stat">ผู้เล่น / ทีม</span><span className="mobile-stat">Club</span></th>{headers.map(([desktop, mobile]) => <th scope="col" key={desktop}><span className="desktop-stat">{desktop}</span><span className="mobile-stat">{mobile}</span></th>)}</tr></thead><tbody>{rows.map((p, i) => <tr key={p.id} className={i === 0 ? 'leader-row' : ''}><td><span className={`rank rank-${i + 1}`}>{i + 1}</span></td><td><button className="player-link" onClick={() => onPlayer(p.id)}><Avatar name={p.player_name} index={i} /><span><strong>{p.player_name}</strong><small>{p.team_name}</small></span>{i === 0 && <Trophy size={15} className="leader-cup" />}</button></td><td>{p.played}</td><td className="green">{p.won}</td><td className="blue">{p.drawn}</td><td className="red">{p.lost}</td><td>{p.gf}</td><td>{p.ga}</td><td>{p.gd > 0 ? '+' : ''}{p.gd}</td><td className="points">{p.points}</td><td><div className="form-dots">{p.form.map((f, j) => <span key={j} className={`form-${f}`} title={{ W: 'ชนะ', D: 'เสมอ', L: 'แพ้' }[f]} aria-label={{ W: 'ชนะ', D: 'เสมอ', L: 'แพ้' }[f]}>{({ W: 'ช', D: 'ส', L: 'พ' })[f]}</span>)}{!p.form.length && '—'}</div></td></tr>)}</tbody></table></div>;
}
export function MatchList({ matches, players, onEdit, onDelete }: { matches: Match[]; players: Player[]; onEdit?: (match: Match) => void; onDelete?: (match: Match) => void }) {
  if (!matches.length) return <Empty>ยังไม่มีผลการแข่งขัน</Empty>;
  const byId = new Map(players.map(p => [p.id, p]));
  return <div className="match-list">{matches.map(m => <div className="match-row" key={m.id}><div className="match-date"><Clock3 size={12} />{new Date(m.played_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', timeZone: 'Asia/Bangkok' })}</div><div className="match-versus"><div className="match-team home-team"><strong>{byId.get(m.home_player_id)?.player_name ?? 'ผู้เล่น'}</strong><small>{byId.get(m.home_player_id)?.team_name}</small></div><span className={`score-pill ${m.home_score === m.away_score ? 'draw' : ''}`}><b>{m.home_score}</b><i>:</i><b>{m.away_score}</b></span><div className="match-team"><strong>{byId.get(m.away_player_id)?.player_name ?? 'ผู้เล่น'}</strong><small>{byId.get(m.away_player_id)?.team_name}</small></div></div>{onEdit && <div className="match-actions"><button className="text-button" onClick={() => onEdit(m)}>แก้ไข</button><button className="text-button danger-text" onClick={() => onDelete?.(m)}>ลบ</button></div>}</div>)}</div>;
}
export function ProgressChart({ players, matches }: { players: Player[]; matches: Match[] }) {
  const series = pointsProgression(players, matches);
  const maxGames = Math.max(1, ...series.map(s => s.points.length - 1));
  const maxPoints = Math.max(6, Math.ceil(Math.max(0, ...series.flatMap(s => s.points)) / 6) * 6);
  return <><div className="chart-wrap"><svg viewBox="0 0 500 230" role="img" aria-label="กราฟแต้มสะสมของผู้เล่นตามจำนวนแมตช์"><title>แต้มสะสม: แกนนอนจำนวนแมตช์ แกนตั้งคะแนน</title>{[0, 1, 2, 3].map(n => { const y = 194 - n * 56; return <g key={n}><line x1="35" y1={y} x2="480" y2={y} stroke="#e9eef5" strokeDasharray="4 5" /><text x="25" y={y + 4} textAnchor="end">{Math.round(n * maxPoints / 3)}</text></g>; })}{[0, Math.ceil(maxGames / 2), maxGames].map((n, i) => <text key={i} x={35 + n / maxGames * 445} y="218" textAnchor="middle">{n}</text>)}{series.map((s, i) => <g key={s.player.id}><polyline fill="none" stroke={colors[i % colors.length]} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" points={s.points.map((p, j) => `${35 + j / maxGames * 445},${194 - p / maxPoints * 168}`).join(' ')} />{s.points.map((p, j) => <circle key={j} cx={35 + j / maxGames * 445} cy={194 - p / maxPoints * 168} r="3" fill={colors[i % colors.length]}><title>{`${s.player.player_name}: นัดที่ ${j}, ${p} แต้ม`}</title></circle>)}</g>)}</svg></div><div className="chart-legend">{series.map((s, i) => <span key={s.player.id}><i style={{ background: colors[i % colors.length] }} />{s.player.player_name}</span>)}</div><p className="chart-note">แต้มสะสม · ตามจำนวนแมตช์ของแต่ละคน</p></>;
}
export function Panel({ title, icon, action, children, className = '' }: { title: string; icon?: ReactNode; action?: { label: string; onClick: () => void }; children: ReactNode; className?: string }) {
  return <section className={`panel ${className}`}><div className="panel-header"><h2>{icon}{title}</h2>{action && <button className="text-button" onClick={action.onClick}>{action.label}<ChevronRight size={15} /></button>}</div>{children}</section>;
}

