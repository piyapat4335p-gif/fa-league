'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import { Home, Trophy, Plus, ChartNoAxesColumnIncreasing, Settings, History, Gamepad2, Users, Goal, TrendingUp, ChevronDown, ArrowUpRight, LogIn, LogOut, Printer, UserPlus, ShieldCheck, RefreshCw, Check, CalendarDays, CircleHelp, Pencil, Trash2, Minus, X, ArrowLeft, Crown, CircleCheck, LoaderCircle } from 'lucide-react';
import type { HistoricalStanding, LeagueData, Match, Player, PlayerFee, Profile, Season, Standing } from '@/lib/types';
import { demoData } from '@/lib/demo';
import { calculateStandings, validateHomeAwaySchedule, validateMatch } from '@/lib/standings';
import { supabase } from '@/lib/supabase';
import { Avatar, Empty, MatchList, Modal, Panel, ProgressChart, StandingsTable } from './ui';

type View = 'home' | 'standings' | 'add' | 'history' | 'stats' | 'settings';
type Dialog = { kind: 'player'; player?: Player } | { kind: 'fee'; player: Player } | { kind: 'season' } | { kind: 'delete-match'; match: Match } | { kind: 'delete-player'; player: Player } | { kind: 'profile-role'; member: Profile; nextRole: Profile['role'] } | { kind: 'detail'; id: string } | null;
const nav = [{ id: 'home', name: 'หน้าแรก', icon: Home }, { id: 'standings', name: 'ตารางคะแนน', icon: Trophy }, { id: 'add', name: 'บันทึกผลแข่ง', icon: Plus }, { id: 'history', name: 'ประวัติการแข่ง', icon: History }, { id: 'stats', name: 'สถิติผู้เล่น', icon: ChartNoAxesColumnIncreasing }, { id: 'settings', name: 'ตั้งค่า', icon: Settings }] as const;
const emptyData: LeagueData = { seasons: [], players: [], matches: [], historicalStandings: [] };
const isDemo = !supabase;
function errorMessage(error: unknown) {
  const code = (error as { code?: string })?.code;
  const message = (error as { message?: string })?.message;
  if (code === '23503') return 'ลบไม่ได้ เพราะผู้เล่นนี้มีผลการแข่งขันแล้ว';
  if (code === '23505') return 'มีข้อมูลนี้อยู่แล้ว กรุณาตรวจสอบอีกครั้ง';
  if (code === '42501') return 'บัญชีนี้ไม่มีสิทธิ์ทำรายการ กรุณาเข้าสู่ระบบด้วยบัญชีที่มีสิทธิ์';
  if (code === '23514') return 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบผู้เล่นและสกอร์';
  if (code === '42P01' || code === 'PGRST205') return 'ยังไม่ได้ตั้งค่าตารางค่าสมัคร กรุณาให้ผู้ดูแลรัน supabase/player-fees.sql ใน Supabase';
  if (message === 'Member not found') return 'ไม่พบสมาชิกคนนี้ในลีก';
  return 'ทำรายการไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อและลองอีกครั้ง';
}
async function readAll<T>(table: string, orderBy = 'id'): Promise<T[]> {
  const rows: T[] = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await supabase!.from(table).select('*').order(orderBy).range(start, start + 999);
    if (error) throw error;
    rows.push(...data as T[]);
    if (data.length < 1000) return rows;
  }
}
async function fetchLeagueData(): Promise<LeagueData> {
  const [seasons, players, matches, historicalStandings] = await Promise.all([readAll<Season>('seasons'), readAll<Player>('players'), readAll<Match>('matches'), readAll<HistoricalStanding>('historical_standings', 'season_id').catch(() => [])]);
  const seasonNumber = (name: string) => Number(name.match(/(\d+)\s*$/)?.[1] ?? -1);
  seasons.sort((a, b) => seasonNumber(b.name) - seasonNumber(a.name) || (b.created_at ?? '').localeCompare(a.created_at ?? ''));
  return { seasons, players, matches, historicalStandings };
}

export default function LeagueApp() {
  const [data, setData] = useState<LeagueData>(isDemo ? demoData : emptyData);
  const [seasonId, setSeasonId] = useState(isDemo ? demoData.seasons[0].id : '');
  const [view, setView] = useState<View>('home');
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [fees, setFees] = useState<PlayerFee[]>([]);
  const [loading, setLoading] = useState(!isDemo);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [editing, setEditing] = useState<Match | null>(null);
  const [filter, setFilter] = useState('');
  const admin = isDemo || (!!user && profile?.id === user.id && profile.role === 'admin');
  const canWrite = isDemo || !!user;

  const receiveData = useCallback((next: LeagueData) => {
    setLoadError('');
    setData(next);
    setSeasonId(current => next.seasons.some(s => s.id === current) ? current : next.seasons.find(s => s.is_active)?.id ?? next.seasons[0]?.id ?? '');
    setLoading(false);
  }, []);
  const receiveError = useCallback(() => {
    setLoadError('โหลดข้อมูลลีกไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อและการตั้งค่าฐานข้อมูล');
    setLoading(false);
  }, []);
  const refresh = useCallback(async () => {
    if (!supabase) return;
    try {
      receiveData(await fetchLeagueData());
    } catch { receiveError(); }
  }, [receiveData, receiveError]);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    fetchLeagueData().then(next => { if (active) receiveData(next); }).catch(() => { if (active) receiveError(); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    const onFocus = () => { void refresh(); };
    window.addEventListener('focus', onFocus);
    return () => { active = false; subscription.unsubscribe(); window.removeEventListener('focus', onFocus); };
  }, [refresh, receiveData, receiveError]);
  useEffect(() => {
    if (!supabase || !user) return;
    let current = true;
    supabase.from('profiles').select('id,display_name,role').eq('id', user.id).single().then(({ data: result }) => { if (current) setProfile(result); });
    return () => { current = false; };
  }, [user]);
  useEffect(() => {
    if (!supabase || !admin) return;
    let current = true;
    supabase.from('profiles').select('id,display_name,role').order('created_at').then(({ data: result, error }) => {
      if (current && !error) setMembers(result as Profile[]);
    });
    return () => { current = false; };
  }, [admin]);
  useEffect(() => {
    if (!supabase || !admin) return;
    let current = true;
    supabase.from('player_fees').select('player_id,paid,note,updated_at').then(({ data: result, error }) => {
      if (current && !error) setFees(result as PlayerFee[]);
    });
    return () => { current = false; };
  }, [admin]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 6500); return () => clearTimeout(timer); }, [notice]);

  const players = useMemo(() => data.players.filter(p => p.season_id === seasonId), [data.players, seasonId]);
  const matches = useMemo(() => data.matches.filter(m => m.season_id === seasonId).sort((a, b) => b.played_at.localeCompare(a.played_at) || b.id.localeCompare(a.id)), [data.matches, seasonId]);
  const pendingFixtures = useMemo(() => {
    const played = new Set(matches.map(match => `${match.home_player_id}:${match.away_player_id}`));
    const remaining: Array<[Player, Player]> = [];
    for (let i = 0; i < players.length; i++) for (let j = 0; j < players.length; j++) {
      if (i !== j && !played.has(`${players[i].id}:${players[j].id}`)) remaining.push([players[i], players[j]]);
    }
    return remaining;
  }, [players, matches]);
  const remainingByPlayer = useMemo(() => players.map(player => ({ player, count: pendingFixtures.filter(pair => pair[0].id === player.id || pair[1].id === player.id).length })).filter(item => item.count > 0), [players, pendingFixtures]);
  const snapshots = useMemo(() => data.historicalStandings.filter(s => s.season_id === seasonId), [data.historicalStandings, seasonId]);
  const rows = useMemo(() => snapshots.length ? snapshots.map(s => {
    const player = players.find(p => p.id === s.player_id)!;
    return { ...player, ...s, id: player.id, player_name: player.player_name, team_name: player.team_name, gd: s.gf - s.ga, form: [] } as Standing;
  }).sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.player_name.localeCompare(b.player_name, 'th')) : calculateStandings(players, matches), [players, matches, snapshots]);
  const season = data.seasons.find(s => s.id === seasonId);
  const totalGoals = snapshots.length ? rows.reduce((n, row) => n + row.gf, 0) : matches.reduce((n, m) => n + m.home_score + m.away_score, 0);
  const completedMatches = snapshots.length ? rows.reduce((n, row) => n + row.played, 0) / 2 : matches.length;
  const go = (next: View) => { setEditing(null); setView(next); setFilter(''); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const openDialog = (next: Dialog) => { setNotice(''); setDialog(next); };
  const showPlayer = (id: string) => openDialog({ kind: 'detail', id });

  async function mutate(remote: () => PromiseLike<{ error: unknown }>, local: (old: LeagueData) => LeagueData, message: string) {
    if (saving.current) return false;
    saving.current = true; setBusy(true);
    try {
      if (supabase) { const { error } = await remote(); if (error) throw error; }
      setData(local); setNotice(message + (isDemo ? ' · ข้อมูลทดลอง' : ''));
      return true;
    } catch (error) { setNotice(errorMessage(error)); return false; }
    finally { saving.current = false; setBusy(false); }
  }
  async function saveMatch(match: Match) {
    if (!canWrite || (editing && !admin)) return false;
    const problem = validateMatch(match);
    if (problem) { setNotice(problem); return false; }
    const scheduleProblem = validateHomeAwaySchedule(matches, match);
    if (scheduleProblem) { setNotice(scheduleProblem); return false; }
    const payload = { ...match, created_by: user?.id ?? null };
    const success = await mutate(() => editing ? supabase!.from('matches').update({ home_player_id: match.home_player_id, away_player_id: match.away_player_id, home_score: match.home_score, away_score: match.away_score, played_at: match.played_at }).eq('id', match.id).select().single() : supabase!.from('matches').insert(payload).select().single(), old => ({ ...old, matches: editing ? old.matches.map(m => m.id === match.id ? { ...m, ...match } : m) : [...old.matches, payload] }), editing ? 'แก้ไขผลการแข่งขันแล้ว' : 'บันทึกผลการแข่งขันแล้ว');
    if (success) { setEditing(null); setView('home'); }
    return success;
  }
  async function savePlayer(event: FormEvent<HTMLFormElement>, old?: Player) {
    event.preventDefault(); if (!admin) return;
    const form = new FormData(event.currentTarget);
    const player: Player = { id: old?.id ?? crypto.randomUUID(), season_id: seasonId, player_name: String(form.get('player_name')).trim(), team_name: String(form.get('team_name')).trim() };
    if (!player.player_name || !player.team_name) { setNotice('กรุณากรอกชื่อผู้เล่นและชื่อทีม'); return; }
    const ok = await mutate(() => old ? supabase!.from('players').update({ player_name: player.player_name, team_name: player.team_name }).eq('id', old.id).select().single() : supabase!.from('players').insert(player).select().single(), d => ({ ...d, players: old ? d.players.map(p => p.id === old.id ? { ...p, ...player } : p) : [...d.players, player] }), 'บันทึกผู้เล่นแล้ว');
    if (ok) setDialog(null);
  }
  async function saveSeason(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!admin) return;
    const name = String(new FormData(event.currentTarget).get('name')).trim();
    if (!name) return;
    const next = { id: crypto.randomUUID(), name, is_active: false };
    const ok = await mutate(() => supabase!.from('seasons').insert(next).select().single(), d => ({ ...d, seasons: [...d.seasons, next] }), 'สร้างฤดูกาลแล้ว');
    if (ok) { setSeasonId(next.id); setDialog(null); }
  }
  async function activateSeason(id: string) {
    if (!admin) return;
    await mutate(() => supabase!.rpc('activate_season', { target_id: id }), d => ({ ...d, seasons: d.seasons.map(s => ({ ...s, is_active: s.id === id })) }), 'เปลี่ยนฤดูกาลปัจจุบันแล้ว');
  }
  async function changeMemberRole(member: Profile, nextRole: Profile['role']) {
    if (!admin || !supabase || member.id === user?.id || saving.current) return;
    saving.current = true; setBusy(true);
    try {
      const { error } = await supabase.rpc('set_profile_role', { target_id: member.id, target_role: nextRole });
      if (error) throw error;
      setMembers(current => current.map(item => item.id === member.id ? { ...item, role: nextRole } : item));
      setNotice(nextRole === 'admin' ? `แต่งตั้ง ${member.display_name || 'สมาชิก'} เป็นแอดมินแล้ว` : `เปลี่ยน ${member.display_name || 'สมาชิก'} เป็นสมาชิกลีกแล้ว`);
      setDialog(null);
    } catch (error) { setNotice(errorMessage(error)); }
    finally { saving.current = false; setBusy(false); }
  }
  async function deleteRecord() {
    if (!admin) return;
    if (dialog?.kind === 'delete-match') {
      const id = dialog.match.id;
      if (await mutate(() => supabase!.from('matches').delete().eq('id', id).select().single(), d => ({ ...d, matches: d.matches.filter(m => m.id !== id) }), 'ลบผลการแข่งขันแล้ว')) setDialog(null);
    } else if (dialog?.kind === 'delete-player') {
      const id = dialog.player.id;
      if (data.matches.some(m => m.home_player_id === id || m.away_player_id === id)) { setNotice('ลบไม่ได้ เพราะผู้เล่นนี้มีผลการแข่งขันแล้ว'); return; }
      if (await mutate(() => supabase!.from('players').delete().eq('id', id).select().single(), d => ({ ...d, players: d.players.filter(p => p.id !== id) }), 'ลบผู้เล่นแล้ว')) setDialog(null);
    }
  }
  async function saveFee(event: FormEvent<HTMLFormElement>, player: Player) {
    event.preventDefault(); if (!admin || !supabase || saving.current) return;
    saving.current = true; setBusy(true);
    const form = new FormData(event.currentTarget);
    const fee: PlayerFee = { player_id: player.id, paid: form.get('paid') === 'on', note: String(form.get('note') ?? '').trim() };
    try {
      const { error } = await supabase.from('player_fees').upsert(fee, { onConflict: 'player_id' });
      if (error) throw error;
      setFees(current => [...current.filter(item => item.player_id !== player.id), fee]);
      setNotice(`บันทึกสถานะค่าสมัครของ ${player.player_name} แล้ว`); setDialog(null);
    } catch (error) { setNotice(errorMessage(error)); }
    finally { saving.current = false; setBusy(false); }
  }
  const editMatch = (match: Match) => { setEditing(match); setView('add'); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  return <div className="app-shell">
    <aside className="sidebar"><a href="#main" className="side-brand" aria-label="FA League"><span className="brand-mark">FA<span>LEAGUE</span></span></a><div className="side-caption">พื้นที่ของลีกเรา</div><nav aria-label="เมนูหลัก">{nav.map(({ id, name, icon: Icon }) => <button key={id} onClick={() => go(id)} className={`nav-item ${view === id ? 'active' : ''}`} aria-current={view === id ? 'page' : undefined}><Icon size={21} />{name}{view === id && <span className="nav-active-dot" />}</button>)}</nav><div className="sidebar-bottom"><div className="live-dot" /> ฤดูกาลแห่งมิตรภาพ<small>ทุกแมตช์มีความหมาย</small><span className="sidebar-version">FA LEAGUE • eFOOTBALL</span></div></aside>
    <div className="main-shell"><header className="topbar"><button className="header-brand" onClick={() => go('home')}><span className="mobile-mark">FA</span><span>FA League<small>ลีกของเพื่อนเรา</small></span><Gamepad2 size={25} /></button><div className="header-actions"><label className="season-select"><CalendarDays size={17} /><span className="sr-only">เลือกฤดูกาล</span><select aria-label="เลือกฤดูกาล" value={seasonId} onChange={e => { setSeasonId(e.target.value); setEditing(null); setFilter(''); if (view === 'add') setView('home'); }}>{!data.seasons.length && <option value="">ยังไม่มีฤดูกาล</option>}{data.seasons.map(s => <option key={s.id} value={s.id}>{s.name}{s.is_active ? ' •' : ''}</option>)}</select><ChevronDown size={14} /></label><button className="account-button" onClick={() => go('settings')} aria-label="บัญชีและการเข้าสู่ระบบ">{user || isDemo ? <span>{isDemo ? 'FA' : (profile && profile.id === user?.id ? profile.display_name : user?.email)?.slice(0, 2).toUpperCase()}</span> : <LogIn size={20} />}</button></div></header>
    <main id="main" className="main-content"><div className="page-heading"><div><div className="eyebrow">{season?.name ?? 'FA LEAGUE'}<span />{season?.is_active ? 'ฤดูกาลปัจจุบัน' : 'ข้อมูลลีก'}</div><h1>{view === 'home' ? 'สนามของเพื่อนเรา' : nav.find(n => n.id === view)?.name}{view === 'home' && <span className="heading-dot">.</span>}</h1><p>{({ home: 'ทุกเกม ทุกแต้ม ทุกโมเมนต์ — รวมไว้ที่นี่', standings: 'อัปเดตอันดับจากผลการแข่งขันทุกแมตช์', add: editing ? 'แก้ไขผลการแข่งขันให้ถูกต้อง' : 'จบเกมแล้ว บันทึกผลกันเลย', history: 'ย้อนดูทุกแมตช์ในฤดูกาล', stats: 'รู้จักฟอร์มของทุกคนให้มากขึ้น', settings: 'บัญชี ผู้เล่น และฤดูกาลของลีก' })[view]}</p></div>{view !== 'add' && <button className="primary heading-action" onClick={() => go('add')}><Plus size={18} />บันทึกผลแข่ง</button>}</div>
    {isDemo && <div className="demo-banner"><CircleHelp size={16} /><span>โหมดทดลอง · ลองบันทึกผลและจัดการลีกได้ ข้อมูลจะเริ่มใหม่เมื่อโหลดหน้าใหม่</span><span className="demo-tag">ตัวอย่าง</span></div>}
    {loadError && <div className="error-banner" role="alert">{loadError}<button className="text-button" onClick={() => void refresh()}>ลองอีกครั้ง</button></div>}
    {loading && <div className="loading-line" role="status"><LoaderCircle className="spin" size={17} /> กำลังโหลดข้อมูลลีก…</div>}
    {(view === 'home' || view === 'standings') && <>
      <div className="summary-grid">{[{ label: 'ผู้เล่นทั้งหมด', value: players.length, unit: 'คนในลีก', icon: Users, tone: 'blue' }, { label: 'แข่งขันแล้ว', value: completedMatches, unit: 'แมตช์', icon: Gamepad2, tone: 'purple' }, { label: 'ประตูรวม', value: totalGoals, unit: 'ประตู', icon: Goal, tone: 'green' }, { label: 'เฉลี่ยต่อแมตช์', value: completedMatches ? (totalGoals / completedMatches).toFixed(1) : '0.0', unit: 'ประตู / แมตช์', icon: TrendingUp, tone: 'orange' }].map(({ label, value, unit, icon: Icon, tone }) => <div className={`summary-card tone-${tone}`} key={label}><div className="summary-top"><span>{label}</span><span className="summary-icon"><Icon size={21} /></span></div><strong>{value}<small>{unit}</small></strong><div className="summary-decoration" /></div>)}</div>
      <Panel title="ตารางคะแนน" icon={<Trophy size={20} />} action={{ label: 'สถิติผู้เล่น', onClick: () => go('stats') }}><StandingsTable rows={rows} onPlayer={showPlayer} /><div className="table-footer"><span><i className="legend-dot" />อันดับ 1 ของลีก</span><span>ชนะ 3 · เสมอ 1 · แพ้ 0 แต้ม</span></div></Panel>
    </>}
    {view === 'home' && <><button className="add-match-banner" onClick={() => go('add')}><span className="add-banner-icon"><Plus size={24} /></span><span><strong>แมตช์ใหม่ พร้อมบันทึกแล้ว?</strong><small>อัปเดตสกอร์ แล้วไปลุ้นอันดับกัน</small></span><ArrowUpRight size={23} /></button><div className="quick-actions"><button onClick={() => admin && seasonId ? openDialog({ kind: 'player' }) : go('settings')}><UserPlus size={21} /><span>เพิ่มผู้เล่น</span><ChevronDown className="quick-arrow" size={16} /></button><button onClick={() => go('settings')}><Users size={21} /><span>จัดการลีก</span><ChevronDown className="quick-arrow" size={16} /></button><button onClick={() => window.print()}><Printer size={21} /><span>พิมพ์รายงาน</span><ChevronDown className="quick-arrow" size={16} /></button></div><div className="dashboard-grid"><Panel title="ดาวซัลโว" icon={<Goal size={20} />} action={{ label: 'ทั้งหมด', onClick: () => go('stats') }}><div className="scorer-list">{[...rows].sort((a, b) => b.gf - a.gf).slice(0, 5).map((p, i) => <button className="scorer-row" key={p.id} onClick={() => showPlayer(p.id)}><span className={`rank rank-${i + 1}`}>{i + 1}</span><Avatar name={p.player_name} index={i} /><span className="scorer-name"><strong>{p.player_name}</strong><small>{p.team_name}</small></span><b>{p.gf}<small>ประตู</small></b></button>)}{!rows.length && <Empty>ยังไม่มีสถิติผู้เล่น</Empty>}</div></Panel><Panel title="ที่สุดของลีก" icon={<ChartNoAxesColumnIncreasing size={20} />}><LeagueRecords rows={rows} /></Panel><Panel title="ผลการแข่งขันล่าสุด" icon={<History size={20} />} action={{ label: 'ดูทั้งหมด', onClick: () => go('history') }}><MatchList matches={matches.slice(0, 5)} players={players} /></Panel><Panel title="เส้นทางสู่แชมป์" icon={<TrendingUp size={20} />}><ProgressChart players={players} matches={matches} /></Panel></div></>}
    {view === 'add' && (canWrite ? <MatchForm key={`${seasonId}:${editing?.id ?? 'new'}`} players={players} matches={matches} seasonId={seasonId} editing={editing} busy={busy} onSave={saveMatch} onCancel={() => go('home')} /> : <Panel title="เข้าสู่ระบบเพื่อบันทึกผล" icon={<ShieldCheck size={20} />}><div className="empty"><LogIn size={32} /><p>ทุกคนดูผลแข่งได้ สมาชิกที่เข้าสู่ระบบจึงจะบันทึกผลได้</p><button className="primary" onClick={() => go('settings')}>เข้าสู่ระบบ</button></div></Panel>)}
    {view === 'history' && <><Panel title={`ผลการแข่งขัน · ${matches.length} แมตช์`} icon={<History size={20} />}><div className="filter-bar"><label>ผู้เล่น<select aria-label="ผู้เล่น" value={filter} onChange={e => setFilter(e.target.value)}><option value="">ทุกคน</option>{players.map(p => <option key={p.id} value={p.id}>{p.player_name} / {p.team_name}</option>)}</select></label><button className="secondary" disabled={loading || isDemo} onClick={() => void refresh()}><RefreshCw size={16} />รีเฟรช</button></div><MatchList matches={matches.filter(m => !filter || m.home_player_id === filter || m.away_player_id === filter)} players={players} onEdit={admin ? editMatch : undefined} onDelete={admin ? match => openDialog({ kind: 'delete-match', match }) : undefined} /></Panel><PendingFixtures pairs={pendingFixtures} remaining={remainingByPlayer} /></>}
    {view === 'stats' && <><div className="dashboard-grid"><Panel title="เส้นทางสู่แชมป์" icon={<TrendingUp size={20} />}><ProgressChart players={players} matches={matches} /></Panel><Panel title="ที่สุดของลีก" icon={<Trophy size={20} />}><LeagueRecords rows={rows} /></Panel></div><div className="player-grid">{rows.map((p, i) => <button className="player-card panel" key={p.id} onClick={() => showPlayer(p.id)}><div className="player-card-heading"><Avatar name={p.player_name} index={i} /><span><strong>{p.player_name}</strong><small>{p.team_name}</small></span><span className="player-card-rank">#{i + 1}</span></div><div className="player-card-stats"><span><b>{p.played}</b>แมตช์</span><span><b className="green">{p.won}</b>ชนะ</span><span><b>{p.gf}</b>ประตู</span><span><b className="blue">{p.points}</b>แต้ม</span></div><div className="player-card-footer">ดูสถิติและแมตช์ล่าสุด<ArrowUpRight size={16} /></div></button>)}</div></>}
    {view === 'settings' && <><Panel title="บัญชีของคุณ" icon={<ShieldCheck size={20} />}><div className="settings-body">{isDemo ? <div className="account-info"><Avatar name="FA" /><div><strong>บัญชีทดลอง</strong><p>ทดลองจัดการลีกได้ครบทุกเมนู เชื่อมต่อฐานข้อมูลเพื่อเริ่มใช้ลีกจริง</p></div><span className="badge">ผู้ดูแลทดลอง</span></div> : user ? <div className="account-info"><Avatar name={profile?.id === user.id ? profile.display_name || 'FA' : 'FA'} /><div><strong>{user.email}</strong><p>{admin ? 'ผู้ดูแลลีก' : 'สมาชิกลีก'}</p></div><button className="secondary" onClick={async () => { const { error } = await supabase!.auth.signOut(); if (error) setNotice('ออกจากระบบไม่สำเร็จ ลองอีกครั้ง'); else { setProfile(null); setNotice('ออกจากระบบแล้ว'); } }}><LogOut size={16} />ออกจากระบบ</button></div> : <AuthForm onMessage={setNotice} />}</div></Panel>
    {admin ? <>{!isDemo && <Panel title="ผู้ดูแลลีก" icon={<ShieldCheck size={20} />}><div className="admin-list">{members.map((member, index) => <div className="admin-row" key={member.id}><Avatar name={member.display_name || 'สมาชิก'} index={index} /><span><strong>{member.display_name || 'ยังไม่ตั้งชื่อ'}</strong><small>{member.id === user?.id ? 'บัญชีของคุณ' : member.role === 'admin' ? 'ผู้ดูแลลีก' : 'สมาชิกลีก'}</small></span><span className={`badge ${member.role === 'admin' ? '' : 'member-badge'}`}>{member.role === 'admin' ? <><Crown size={14} />แอดมิน</> : 'สมาชิก'}</span>{member.id !== user?.id && <button className={member.role === 'admin' ? 'secondary' : 'primary'} disabled={busy} onClick={() => openDialog({ kind: 'profile-role', member, nextRole: member.role === 'admin' ? 'player' : 'admin' })}>{member.role === 'admin' ? 'ถอดสิทธิ์' : 'แต่งตั้งแอดมิน'}</button>}</div>)}{!members.length && <Empty>ยังไม่มีสมาชิกคนอื่นสมัครเข้าลีก</Empty>}</div><p className="admin-help">สมาชิกต้องสมัครและยืนยันอีเมลก่อน จึงจะแสดงในรายการนี้</p></Panel>}<Panel title="ผู้เล่นในฤดูกาล" icon={<Users size={20} />} action={seasonId ? { label: 'เพิ่มผู้เล่น', onClick: () => openDialog({ kind: 'player' }) } : undefined}><div className="admin-list">{players.map((p, i) => { const fee = fees.find(item => item.player_id === p.id); return <div className="admin-row" key={p.id}><Avatar name={p.player_name} index={i} /><span><strong>{p.player_name}</strong><small>{p.team_name}{fee?.note ? ` · ${fee.note}` : ''}</small></span><button className={fee?.paid ? 'fee-paid' : 'fee-pending'} onClick={() => openDialog({ kind: 'fee', player: p })}>{fee?.paid ? 'ชำระแล้ว' : 'รอชำระ'}</button><button className="icon-button" aria-label={`แก้ไข ${p.player_name}`} onClick={() => openDialog({ kind: 'player', player: p })}><Pencil size={17} /></button><button className="icon-button danger-text" aria-label={`ลบ ${p.player_name}`} onClick={() => openDialog({ kind: 'delete-player', player: p })}><Trash2 size={17} /></button></div>; })}{!players.length && <Empty>เพิ่มผู้เล่นเพื่อเริ่มฤดูกาล</Empty>}</div></Panel><Panel title="จัดการฤดูกาล" icon={<CalendarDays size={20} />} action={{ label: 'สร้างฤดูกาล', onClick: () => openDialog({ kind: 'season' }) }}><div className="admin-list">{data.seasons.map(s => <div className="admin-row" key={s.id}><Trophy size={21} /><span><strong>{s.name}</strong><small>{s.is_active ? 'ฤดูกาลปัจจุบัน' : 'ฤดูกาลอื่น'}</small></span>{s.is_active ? <span className="badge"><Check size={14} />ใช้งานอยู่</span> : <button className="secondary" disabled={busy} onClick={() => void activateSeason(s.id)}>ใช้ฤดูกาลนี้</button>}</div>)}</div></Panel></> : user && <div className="info-note"><ShieldCheck size={18} />การเพิ่มผู้เล่นและจัดการฤดูกาลสงวนไว้สำหรับผู้ดูแลลีก</div>}</>}
    <footer className="page-footer"><span>FA LEAGUE<span className="footer-dot"> / </span>เกมของเรา ลีกของเรา</span><span>สร้างความทรงจำผ่านทุกแมตช์ <Gamepad2 size={15} /></span></footer></main></div>
    <nav className="bottom-nav" aria-label="เมนูมือถือ">{nav.map(({ id, name, icon: Icon }) => <button key={id} className={`${view === id ? 'active' : ''} ${id === 'add' ? 'bottom-add' : ''}`} onClick={() => go(id)} aria-label={name} aria-current={view === id ? 'page' : undefined}><span><Icon size={22} /></span><small>{id === 'history' ? 'ประวัติ' : id === 'stats' ? 'สถิติ' : id === 'add' ? 'บันทึกผล' : name}</small></button>)}</nav>
    {notice && <div className="toast" role="status"><CircleCheck size={19} /><span>{notice}</span><button className="icon-button" aria-label="ปิดข้อความ" onClick={() => setNotice('')}><X size={17} /></button></div>}
    {dialog?.kind === 'player' && <Modal title={dialog.player ? 'แก้ไขผู้เล่น' : 'เพิ่มผู้เล่นใหม่'} feedback={notice} onClose={() => !busy && setDialog(null)}><form className="form-body" onSubmit={e => void savePlayer(e, dialog.player)}><label>ชื่อผู้เล่น<input name="player_name" maxLength={60} required defaultValue={dialog.player?.player_name} placeholder="เช่น Ta" /></label><label>ชื่อทีม<input name="team_name" maxLength={80} required defaultValue={dialog.player?.team_name} placeholder="เช่น Gunner" /></label><button className="primary" disabled={busy}>{busy ? 'กำลังบันทึก…' : 'บันทึกผู้เล่น'}</button></form></Modal>}
    {dialog?.kind === 'season' && <Modal title="สร้างฤดูกาลใหม่" feedback={notice} onClose={() => !busy && setDialog(null)}><form className="form-body" onSubmit={e => void saveSeason(e)}><label>ชื่อฤดูกาล<input name="name" required maxLength={80} placeholder="เช่น FA League 21" /></label><p className="muted">สร้างแล้วเพิ่มผู้เล่น และเลือกใช้เป็นฤดูกาลปัจจุบันได้</p><button className="primary" disabled={busy}>สร้างฤดูกาล</button></form></Modal>}
    {dialog?.kind === 'fee' && <Modal title={`ค่าสมัคร · ${dialog.player.player_name}`} feedback={notice} onClose={() => !busy && setDialog(null)}><form className="form-body" onSubmit={e => void saveFee(e, dialog.player)}><label className="fee-toggle"><input type="checkbox" name="paid" defaultChecked={fees.find(item => item.player_id === dialog.player.id)?.paid} /> ชำระค่าสมัครแล้ว</label><label>โน้ตสำหรับแอดมิน<input name="note" maxLength={160} defaultValue={fees.find(item => item.player_id === dialog.player.id)?.note} placeholder="เช่น โอนแล้ว 500 บาท" /></label><button className="primary" disabled={busy}>{busy ? 'กำลังบันทึก…' : 'บันทึกสถานะ'}</button></form></Modal>}
    {(dialog?.kind === 'delete-match' || dialog?.kind === 'delete-player') && <Modal title="ยืนยันการลบ" feedback={notice} onClose={() => !busy && setDialog(null)}><div className="form-body"><p>{dialog.kind === 'delete-player' ? `ลบ ${dialog.player.player_name} ออกจากฤดูกาลนี้?` : 'ลบผลการแข่งขันนี้? ตารางคะแนนจะคำนวณใหม่ทันที'}</p><p className="muted">รายการที่ลบแล้วจะกู้คืนจากหน้านี้ไม่ได้</p><div className="button-row"><button className="secondary" disabled={busy} onClick={() => setDialog(null)}>ยกเลิก</button><button className="danger-button" disabled={busy} onClick={() => void deleteRecord()}>ยืนยันลบ</button></div></div></Modal>}
    {dialog?.kind === 'profile-role' && <Modal title={dialog.nextRole === 'admin' ? 'แต่งตั้งผู้ดูแลลีก' : 'ถอดสิทธิ์ผู้ดูแล'} feedback={notice} onClose={() => !busy && setDialog(null)}><div className="form-body"><p>{dialog.nextRole === 'admin' ? `ให้ ${dialog.member.display_name || 'สมาชิกคนนี้'} เป็นแอดมิน? เขาจะจัดการผู้เล่น ฤดูกาล และผลแข่งขันได้` : `เปลี่ยน ${dialog.member.display_name || 'สมาชิกคนนี้'} เป็นสมาชิกลีก? เขาจะจัดการลีกไม่ได้`}</p><div className="button-row"><button className="secondary" disabled={busy} onClick={() => setDialog(null)}>ยกเลิก</button><button className={dialog.nextRole === 'admin' ? 'primary' : 'danger-button'} disabled={busy} onClick={() => void changeMemberRole(dialog.member, dialog.nextRole)}>{dialog.nextRole === 'admin' ? 'ยืนยันแต่งตั้ง' : 'ยืนยันถอดสิทธิ์'}</button></div></div></Modal>}
    {dialog?.kind === 'detail' && <Modal title="สถิติผู้เล่น" onClose={() => setDialog(null)}><PlayerDetail row={rows.find(p => p.id === dialog.id)} matches={matches.filter(m => m.home_player_id === dialog.id || m.away_player_id === dialog.id)} players={players} /></Modal>}
  </div>;
}

function PendingFixtures({ pairs, remaining }: { pairs: Array<[Player, Player]>; remaining: Array<{ player: Player; count: number }> }) {
  return <Panel title={`นัดที่ยังไม่ได้แข่ง · ${pairs.length} นัด`} icon={<Gamepad2 size={20} />}><div className="pending-fixtures"><p className="pending-help">แต่ละคู่แข่ง 2 นัด โดยสลับกันเป็นเจ้าบ้านและทีมเยือน</p>{remaining.length > 0 && <div className="pending-summary">{remaining.map(({ player, count }) => <span key={player.id}>{player.player_name}<b>เหลือ {count} นัด</b></span>)}</div>}<div className="fixture-list">{pairs.map(([home, away]) => <div className="fixture-row" key={`${home.id}-${away.id}`}><span><Avatar name={home.player_name} /><strong>{home.player_name}</strong><small>{home.team_name} · เหย้า</small></span><b>VS</b><span><Avatar name={away.player_name} /><strong>{away.player_name}</strong><small>เยือน · {away.team_name}</small></span></div>)}{!pairs.length && <Empty>แข่งขันเหย้า–เยือนครบทุกคู่แล้ว</Empty>}</div></div></Panel>;
}

function LeagueRecords({ rows }: { rows: Standing[] }) {
  const records = [{ label: 'ชนะมากที่สุด', key: 'won', icon: Trophy, color: 'green' }, { label: 'ประตูได้มากที่สุด', key: 'gf', icon: Goal, color: 'blue' }, { label: 'ลงแข่งมากที่สุด', key: 'played', icon: Gamepad2, color: 'purple' }, { label: 'เสมอมากที่สุด', key: 'drawn', icon: Minus, color: 'orange' }, { label: 'แพ้มากที่สุด', key: 'lost', icon: History, color: 'red' }, { label: 'เสียประตูมากที่สุด', key: 'ga', icon: Goal, color: 'muted' }] as const;
  return <div className="records-list">{records.map(({ label, key, icon: Icon, color }) => { const max = Math.max(0, ...rows.map(p => p[key])); const leaders = rows.filter(p => p[key] === max && p.played > 0); return <div className="record-row" key={key}><span className={`record-icon ${color}`}><Icon size={17} /></span><span><strong>{label}</strong><small>{leaders.length ? leaders.map(p => p.player_name).join(', ') : 'ยังไม่มีการแข่งขัน'}</small></span><b>{max}</b></div>; })}</div>;
}

function MatchForm({ players, matches, seasonId, editing, busy, onSave, onCancel }: { players: Player[]; matches: Match[]; seasonId: string; editing: Match | null; busy: boolean; onSave: (match: Match) => Promise<boolean>; onCancel: () => void }) {
  const [home, setHome] = useState(editing?.home_player_id ?? '');
  const [away, setAway] = useState(editing?.away_player_id ?? '');
  const [homeScore, setHomeScore] = useState(editing?.home_score ?? 0);
  const [awayScore, setAwayScore] = useState(editing?.away_score ?? 0);
  const [date, setDate] = useState(() => { const d = editing ? new Date(editing.played_at) : new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); });
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const matchId = useRef('');
  function prepare(event: FormEvent) {
    event.preventDefault();
    const validation = validateMatch({ home_player_id: home, away_player_id: away, home_score: homeScore, away_score: awayScore, played_at: date });
    if (validation) { setError(validation); return; }
    const scheduleProblem = validateHomeAwaySchedule(matches, { id: editing?.id ?? '', home_player_id: home, away_player_id: away });
    if (scheduleProblem) { setError(scheduleProblem); return; }
    if (!matchId.current) matchId.current = editing?.id ?? crypto.randomUUID();
    setError(''); setConfirm(true);
  }
  if (players.length < 2) return <Panel title="เตรียมผู้เล่นก่อนเริ่มแข่ง"><Empty>ต้องมีผู้เล่นอย่างน้อย 2 คนในฤดูกาลนี้ ให้ผู้ดูแลเพิ่มผู้เล่นในหน้าตั้งค่า</Empty></Panel>;
  const homePlayer = players.find(p => p.id === home), awayPlayer = players.find(p => p.id === away);
  return <><section className="match-form panel"><div className="match-form-top"><Gamepad2 size={26} /><span>{editing ? 'แก้ไขผลการแข่งขัน' : 'บันทึกแมตช์ใหม่'}</span><span className="badge">ลีก</span></div><form onSubmit={prepare}><div className="match-form-players">{[{ name: 'ผู้เล่นเหย้า', value: home, other: away, setter: setHome, score: homeScore, setScore: setHomeScore }, { name: 'ผู้เล่นเยือน', value: away, other: home, setter: setAway, score: awayScore, setScore: setAwayScore }].map((side, index) => <div className="match-form-side" key={side.name}><span className={`side-label ${index ? 'away-label' : ''}`}>{side.name}</span><label><span className="sr-only">{side.name}</span><select aria-label={side.name} required value={side.value} onChange={e => { side.setter(e.target.value); setError(''); }}><option value="">เลือกผู้เล่น</option>{players.map(p => <option key={p.id} value={p.id} disabled={p.id === side.other}>{p.player_name}</option>)}</select></label><p className="team-name">{players.find(p => p.id === side.value)?.team_name ?? 'เลือกผู้เล่นเพื่อแสดงทีม'}</p><div className="score-control"><button type="button" aria-label={`ลดสกอร์ ${side.name}`} disabled={side.score <= 0} onClick={() => side.setScore(s => Math.max(0, s - 1))}><Minus size={19} /></button><input type="number" min={0} max={99} required aria-label={`สกอร์ ${side.name}`} value={side.score} onChange={e => side.setScore(e.target.value === '' ? 0 : Number(e.target.value))} /><button type="button" aria-label={`เพิ่มสกอร์ ${side.name}`} disabled={side.score >= 99} onClick={() => side.setScore(s => Math.min(99, s + 1))}><Plus size={19} /></button></div>{index === 0 && <span className="versus-label">VS</span>}</div>)}</div><div className="match-form-bottom"><label>วันและเวลาแข่งขัน<input type="datetime-local" value={date} required onChange={e => setDate(e.target.value)} /></label>{error && <p className="field-error" role="alert">{error}</p>}<button className="primary save-match" disabled={busy}><CircleCheck size={19} />{editing ? 'ตรวจสอบผลที่แก้ไข' : 'บันทึกผลการแข่งขัน'}</button><button type="button" className="text-button cancel-match" onClick={onCancel}><ArrowLeft size={15} />กลับหน้าหลัก</button></div></form></section>{confirm && <Modal title="ยืนยันผลการแข่งขัน" feedback={error} onClose={() => !busy && setConfirm(false)}><div className="form-body"><div className="confirmation-score"><span>{homePlayer?.player_name}<small>เหย้า · {homePlayer?.team_name}</small></span><b>{homeScore} : {awayScore}</b><span>{awayPlayer?.player_name}<small>เยือน · {awayPlayer?.team_name}</small></span></div><p className="muted">{new Date(date).toLocaleString('th-TH')}</p><p>ตรวจสอบสกอร์และฝั่งเหย้า–เยือนให้ถูกต้องก่อนบันทึก</p><div className="button-row"><button className="secondary" disabled={busy} onClick={() => setConfirm(false)}>กลับไปแก้ไข</button><button className="primary" disabled={busy} onClick={async () => { if (await onSave({ id: matchId.current, season_id: seasonId, home_player_id: home, away_player_id: away, home_score: homeScore, away_score: awayScore, played_at: new Date(date).toISOString() })) setConfirm(false); }}>{busy ? 'กำลังบันทึก…' : 'ยืนยันบันทึก'}</button></div></div></Modal>}</>;
}

function AuthForm({ onMessage }: { onMessage: (message: string) => void }) {
  const [register, setRegister] = useState(false), [pending, setPending] = useState(false), [email, setEmail] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending) return;
    const form = new FormData(event.currentTarget); setPending(true);
    try {
      const credentials = { email: email.trim(), password: String(form.get('password')) };
      const result = register ? await supabase!.auth.signUp({ ...credentials, options: { data: { display_name: String(form.get('name')).trim() }, emailRedirectTo: window.location.origin } }) : await supabase!.auth.signInWithPassword(credentials);
      if (result.error) onMessage(result.error.code === 'email_not_confirmed' ? 'อีเมลยังไม่ยืนยัน กด “ส่งอีเมลยืนยันใหม่” ด้านล่าง' : register ? 'สมัครไม่สำเร็จ กรุณาตรวจสอบข้อมูลหรือลองเข้าสู่ระบบ' : 'เข้าสู่ระบบไม่สำเร็จ ตรวจสอบอีเมล รหัสผ่าน และการยืนยันอีเมล');
      else onMessage(register && !result.data.session ? 'สมัครแล้ว กรุณากดยืนยันในอีเมลก่อนเข้าสู่ระบบ' : 'เข้าสู่ระบบแล้ว');
    } catch { onMessage('เชื่อมต่อไม่ได้ กรุณาลองอีกครั้ง'); }
    finally { setPending(false); }
  }
  async function resendConfirmation() {
    if (!email.trim()) { onMessage('กรอกอีเมลที่ใช้สมัครก่อน แล้วกดส่งอีเมลยืนยันใหม่'); return; }
    if (pending) return;
    setPending(true);
    try {
      const { error } = await supabase!.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: window.location.origin } });
      if (error) onMessage(error.code === 'over_email_send_rate_limit' ? 'ส่งอีเมลถี่เกินไป กรุณารอประมาณ 1 นาทีแล้วลองใหม่' : 'ส่งอีเมลยืนยันใหม่ไม่สำเร็จ กรุณาตรวจอีเมลแล้วลองอีกครั้ง');
      else onMessage('ส่งอีเมลยืนยันใหม่แล้ว ใช้ลิงก์ฉบับล่าสุดเพียงฉบับเดียว');
    } catch { onMessage('เชื่อมต่อไม่ได้ กรุณาลองอีกครั้ง'); }
    finally { setPending(false); }
  }
  return <form className="auth-form form-body" onSubmit={submit}><h3>{register ? 'สมัครสมาชิกลีก' : 'เข้าสู่ระบบ'}</h3>{register && <label>ชื่อที่แสดง<input name="name" required maxLength={60} autoComplete="nickname" /></label>}<label>อีเมล<input type="email" name="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} /></label><label>รหัสผ่าน<input type="password" name="password" required minLength={8} autoComplete={register ? 'new-password' : 'current-password'} /></label><button className="primary" disabled={pending}>{pending ? 'กำลังดำเนินการ…' : register ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}</button>{!register && <button type="button" className="secondary" disabled={pending} onClick={() => void resendConfirmation()}>ส่งอีเมลยืนยันใหม่</button>}<button type="button" className="text-button" onClick={() => setRegister(!register)}>{register ? 'มีบัญชีแล้ว? เข้าสู่ระบบ' : 'ยังไม่มีบัญชี? สมัครสมาชิก'}</button></form>;
}

function PlayerDetail({ row, matches, players }: { row?: Standing; matches: Match[]; players: Player[] }) {
  if (!row) return <Empty>ไม่พบผู้เล่นในฤดูกาลนี้</Empty>;
  return <div className="player-detail"><div className="detail-heading"><Avatar name={row.player_name} /><div><h3>{row.player_name}</h3><p>{row.team_name}</p></div><Crown size={24} className="blue" /></div><div className="detail-stats">{[['แข่ง', row.played], ['ชนะ', row.won], ['เสมอ', row.drawn], ['แพ้', row.lost], ['ประตูได้', row.gf], ['ประตูเสีย', row.ga], ['ผลต่าง', row.gd], ['แต้ม', row.points]].map(([label, value]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div><h3 className="detail-recent-title">แมตช์ล่าสุด</h3><MatchList matches={matches.slice(0, 5)} players={players} /></div>;
}

