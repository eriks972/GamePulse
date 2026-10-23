#!/usr/bin/env python3
"""Import a checked MLB prepared run as an atomic GamePulse API snapshot. Python 3.10+."""
import argparse, contextlib, fcntl, hashlib, json, math, re, sys, uuid
from collections import defaultdict
from datetime import datetime, timezone, date
from pathlib import Path
from mlb_batting import build_batting
from mlb_pitching import build_pitching

FILES=['teams','players','games','rosters','team_game_stats','player_game_stats','line_scores','standings','coverage']
def read(path):return json.loads(path.read_text(encoding='utf-8'))
def sha(path):
 h=hashlib.sha256()
 with path.open('rb') as f:
  for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
 return h.hexdigest()
def write(path,data):
 path.parent.mkdir(parents=True,exist_ok=True);tmp=path.with_name(path.name+'.tmp')
 tmp.write_text(json.dumps(data,ensure_ascii=False,allow_nan=False,separators=(',',':'))+'\n',encoding='utf-8');tmp.replace(path)
def inside(root,relative):
 p=(root/relative).resolve()
 if not p.is_relative_to(root):raise ValueError('Path escapes snapshot directory')
 return p
def identifier(value,kind):return isinstance(value,str) and re.fullmatch(r'mlb:stats:'+kind+r':[1-9]\d*',value) is not None
def whole(v):return v is None or isinstance(v,int) and not isinstance(v,bool) and v>=0
def unique(rows,kind):
 index={}
 for r in rows:
  if not isinstance(r,dict) or not identifier(r.get('id'),kind) or r['id'] in index or r.get('sourceId')!=r['id'].split(':')[-1]:raise ValueError(f'Invalid/duplicate {kind} identity')
  index[r['id']]=r
 return index
@contextlib.contextmanager
def lock(root):
 root.mkdir(parents=True,exist_ok=True)
 with (root/'.import.lock').open('a') as f:
  try:fcntl.flock(f,fcntl.LOCK_EX|fcntl.LOCK_NB)
  except BlockingIOError:raise ValueError('Another MLB import is running') from None
  try:yield
  finally:fcntl.flock(f,fcntl.LOCK_UN)
def import_run(ready,destination,requested=None):
 ready=ready.expanduser().resolve();destination=destination.expanduser().resolve()
 if ready==destination or ready.is_relative_to(destination) or destination.is_relative_to(ready):raise ValueError('Keep API output separate from prepared data')
 pointer=read(ready/'current.json');source=inside(ready,pointer['run'])
 if not source.is_relative_to(ready/'runs'):raise ValueError('Prepared pointer must identify a completed runs/ snapshot')
 checks=read(source/'checksums.json');years=read(source/'seasons.json')
 if not isinstance(years,list) or not years or any(type(y)!=int or not 1876<=y<=9999 for y in years):raise ValueError('Invalid prepared season index')
 selected=sorted(set(requested or years))
 if any(y not in years for y in selected):raise ValueError('A requested season is not present in this prepared run')
 with lock(destination):
  stamp=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S')+'-'+uuid.uuid4().hex[:8];stage=destination/('building-'+stamp);stage.mkdir()
  counts=[]
  for year in selected:
   folder=source/'seasons'/str(year)
   for name in FILES:
    p=folder/(name+'.json');relative=str(p.relative_to(source))
    if relative not in checks or sha(p)!=checks[relative]:raise ValueError(f'Prepared checksum missing/mismatched: {relative}')
   teams=unique(read(folder/'teams.json'),'team');players=unique(read(folder/'players.json'),'player');games=unique(read(folder/'games.json'),'game')
   if not teams or not games:raise ValueError('A season requires teams and games')
   for g in games.values():
    if g.get('season')!=year or g.get('homeTeamId') not in teams or g.get('awayTeamId') not in teams or g['homeTeamId']==g['awayTeamId'] or type(g.get('completed'))!=bool or not whole(g.get('homeScore')) or not whole(g.get('awayScore')):raise ValueError('Invalid game relationship, season, score, or status')
    date.fromisoformat(g['officialDate'])
   parts={gid:dict(teamStatistics=[],playerStatistics=[],lineScores=[]) for gid in games}
   player_teams=defaultdict(set);player_games=defaultdict(set);roster_teams=defaultdict(set)
   total_stats=0
   for name,array in [('team_game_stats','teamStatistics'),('player_game_stats','playerStatistics')]:
    seen=set()
    for row in read(folder/(name+'.json')):
     gid=row.get('gameId');g=games.get(gid);tid=row.get('teamId');pid=row.get('playerId');group=row.get('group');identity=(gid,tid,pid,group)
     if not g or not g['completed'] or tid not in (g['homeTeamId'],g['awayTeamId']) or row.get('opponentTeamId') not in (g['homeTeamId'],g['awayTeamId']) or row['opponentTeamId']==tid or row.get('season')!=year or row.get('seasonType')!=g.get('seasonType') or group not in ('batting','pitching','fielding') or identity in seen or array=='playerStatistics' and pid not in players or array=='teamStatistics' and pid is not None:raise ValueError('Invalid/duplicate game statistics relationship')
     seen.add(identity);values=row.get('statistics')
     if not isinstance(values,dict):raise ValueError('Statistics must be an object')
     for k,v in values.items():
      if v is None:continue
      if k=='inningsPitched':
       if not isinstance(v,str) or not re.fullmatch(r'\d+\.[012]|\d+',v):raise ValueError('Invalid innings notation')
      elif isinstance(v,bool) or not isinstance(v,(int,float)) or not math.isfinite(v) or v<0:raise ValueError('Invalid statistic value')
     parts[gid][array].append(row);total_stats+=1
     if pid:player_teams[pid].add(tid);player_games[pid].add(gid)
   seen_lines=set()
   for row in read(folder/'line_scores.json'):
    gid=row.get('gameId');g=games.get(gid);tid=row.get('teamId');num=row.get('inning');identity=(gid,tid,num)
    if not g or tid not in (g['homeTeamId'],g['awayTeamId']) or type(num)!=int or num<1 or identity in seen_lines or any(not whole(row.get(k)) for k in ('runs','hits','errors','leftOnBase')):raise ValueError('Invalid/duplicate inning row')
    seen_lines.add(identity);parts[gid]['lineScores'].append(row)
   for row in read(folder/'rosters.json'):
    if row.get('playerId') not in players or row.get('teamId') not in teams:raise ValueError('Invalid roster relationship')
    roster_teams[row['playerId']].add(row['teamId'])
   provider=read(folder/'standings.json');seen_standings=set()
   for row in provider:
    if row.get('season')!=year or row.get('teamId') not in teams or row['teamId'] in seen_standings or not whole(row.get('wins')) or not whole(row.get('losses')):raise ValueError('Invalid provider standings')
    seen_standings.add(row['teamId'])
   coverage=read(folder/'coverage.json')
   if coverage.get('season')!=year:raise ValueError('Coverage season mismatch')
   dest=stage/'seasons'/str(year)
   for t in teams.values():t['season']=year
   for p in players.values():p.update(season=year,teamIds=sorted(player_teams[p['id']]),rosterSnapshotTeamIds=sorted(roster_teams[p['id']]),gameIds=sorted(player_games[p['id']]))
   for gid,g in games.items():
    part=parts[gid];g['coverage']=dict(teamGroupRows=len(part['teamStatistics']),playerGroupRows=len(part['playerStatistics']),inningRows=len(part['lineScores']))
    write(dest/'game_stats'/(g['sourceId']+'.json'),part)
   write(dest/'batting.json',build_batting(parts,year))
   write(dest/'pitching.json',build_pitching(parts,year))
   for name,value in [('teams',list(teams.values())),('players',list(players.values())),('games',list(games.values())),('standings',provider),('coverage',{k:v for k,v in coverage.items() if k!='inputs'})]:write(dest/(name+'.json'),value)
   counts.append(dict(season=year,teams=len(teams),players=len(players),games=len(games),statisticGroupRows=total_stats));print(f'{year}: imported {len(games)} games, {len(players)} player identities; game statistics partitioned',flush=True)
  write(stage/'seasons.json',selected)
  write(stage/'import_report.json',dict(version=1,createdAt=datetime.now(timezone.utc).isoformat(),preparedRun=source.name,preparedChecksumsSha256=sha(source/'checksums.json'),seasons=counts))
  write(stage/'checksums.json',{str(p.relative_to(stage)):sha(p) for p in stage.rglob('*.json')})
  final=destination/'runs'/stamp;final.parent.mkdir(exist_ok=True);stage.replace(final)
  write(destination/'current.json',dict(version=1,league='mlb',run=str(final.relative_to(destination)),seasons=selected))
  print(f'Imported snapshot: {final}\nActive pointer: {destination / "current.json"}',flush=True)
  return final

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--input',type=Path,required=True,help='Collector mlb_data/ready directory');p.add_argument('--destination',type=Path,required=True,help='API Data/processed/mlb directory');p.add_argument('--seasons',type=int,nargs='+');a=p.parse_args()
 try:import_run(a.input,a.destination,a.seasons);return 0
 except KeyboardInterrupt:print('Interrupted; current pointer unchanged unless import already completed.',file=sys.stderr);return 130
 except Exception as e:print(f'Import failed: {e}. The previous current pointer was retained.',file=sys.stderr);return 1
if __name__=='__main__':sys.exit(main())
