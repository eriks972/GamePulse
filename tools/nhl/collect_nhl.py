#!/usr/bin/env python3
"""SportsDataverse NHL snapshots. Season arguments use ENDING years: 2026 = 2025–26."""
import argparse,collections,concurrent.futures,csv,fcntl,gzip,hashlib,json,math,os,re,shutil,sys,tempfile,time,urllib.request,urllib.error,uuid
from datetime import datetime,timezone
from pathlib import Path

SOURCES={'schedule':('nhl_schedules','nhl_schedule_'), 'teams':('nhl_team_boxscores','team_box_'), 'players':('nhl_player_boxscores','player_box_'), 'scoring':('nhl_scoring','scoring_'), 'rosters':('nhl_rosters','rosters_'), 'lines':('nhl_linescore','linescore_')}
SKATER={'goals':'goals','assists':'assists','points':'points','plusMinus':'plus_minus','penaltyMinutes':'pim','shots':'shots_on_goal','hits':'hits','blocks':'blocked_shots','powerPlayGoals':'power_play_goals','giveaways':'giveaways','takeaways':'takeaways'}
GOALIE={'saves':'saves','shotsAgainst':'shots_against','goalsAgainst':'goals_against'}
TEAM={'goals':'goals','shots':'shots_on_goal','penaltyMinutes':'pim','hits':'hits','blocks':'blocked_shots','powerPlayGoals':'power_play_goals','giveaways':'giveaways','takeaways':'takeaways','saves':'saves','goalsAgainst':'goals_against'}

def write(path,value):
 path.parent.mkdir(parents=True,exist_ok=True);tmp=path.with_name(path.name+'.tmp');tmp.write_text(json.dumps(value,ensure_ascii=False,allow_nan=False,separators=(',',':'))+'\n');os.replace(tmp,path)
def sha(path):
 h=hashlib.sha256()
 with path.open('rb') as f:
  for block in iter(lambda:f.read(1024*1024),b''):h.update(block)
 return h.hexdigest()
def number(v,signed=False):
 if isinstance(v,bool) or not isinstance(v,(int,float)) or not math.isfinite(v) or int(v)!=v or (v<0 and not signed):return None
 return int(v)
def seconds(v):
 if not isinstance(v,str) or not re.fullmatch(r'\d{1,4}:[0-5]\d',v):return None
 m,s=map(int,v.split(':'));return m*60+s

def prepare(year,source):
 games={};teams={};players={};review=[];team_stats=[];player_stats=[];scoring=[]
 def issue(code,**ctx):review.append(dict(code=code,**ctx))
 def make_id(kind,v):
  n=number(v)
  if n is None or n<1:raise ValueError('Invalid NHL '+kind+' identity')
  return 'nhl:'+kind+':'+str(n)
 def tid(v):return make_id('team',v)
 def pid(v):return make_id('player',v)
 # Team IDs are joined from the season's own boxes/lines, not current franchises.
 abbr_ids={}
 for r in source['teams']:
  identity=tid(r['team_id']);abbr=r.get('team_abbrev');abbr_ids.setdefault(abbr,set()).add(identity)
  teams[identity]=dict(id=identity,name=r.get('team_name') or abbr,abbreviation=abbr)
 for r in source['lines']:
  for side in ('home','away'):
   if r.get(side+'_team_id'):
    identity=tid(r[side+'_team_id']);abbr=r.get(side+'_team_abbr');abbr_ids.setdefault(abbr,set()).add(identity)
    teams.setdefault(identity,dict(id=identity,name=abbr,abbreviation=abbr))
 for r in source['schedule']:
  gid=str(number(r.get('game_id')) or '');phase={'R':'Regular Season','P':'Playoffs','PR':'Preseason','A':'All-Star'}.get(str(r.get('game_type')))
  if not phase:issue('unsupported_game_type',gameId=gid,value=r.get('game_type'));continue
  # Explicit NHL game identity encodes starting year and phase.
  if not re.fullmatch(r'\d{10}',gid) or int(gid[:4])+1!=year:raise ValueError('Schedule season/identity mismatch')
  home=abbr_ids.get(r.get('home_team_abbr'),set());away=abbr_ids.get(r.get('away_team_abbr'),set())
  if len(home)!=1 or len(away)!=1:
   if phase=='Preseason':issue('excluded_preseason_team_identity',gameId=gid,home=r.get('home_team_abbr'),away=r.get('away_team_abbr'));continue
   raise ValueError(f'{gid}: ambiguous/missing season team identity')
  home=next(iter(home));away=next(iter(away))
  if home==away:raise ValueError('Identical opponents')
  date=str(r.get('game_date'))[:10];datetime.strptime(date,'%Y-%m-%d')
  for side,t in [('home',home),('away',away)]:
   name=r.get(side+'_team_name');suffix=teams[t]['name']
   if name and suffix and not name.lower().endswith(suffix.lower()):teams[t]['name']=name+' '+suffix
  game=dict(id=gid,season=year,seasonType=phase,date=date,startTime=str(r.get('game_time') or ''),homeTeamId=home,awayTeamId=away,homeScore=number(r.get('home_score')),awayScore=number(r.get('away_score')),status=r.get('game_state'),completed=r.get('game_state') in ('OFF','FINAL'),venue=r.get('venue'),finish='Unknown')
  if gid in games and games[gid]!=game:raise ValueError('Conflicting schedule identities')
  games[gid]=game
 seen=set()
 def relationship(r,kind):
  if number(r.get('game_id')) is None:raise ValueError(f'{kind} release omits a valid game_id; refusing to infer game associations from row order')
  gid=str(number(r.get('game_id')));game=games.get(gid)
  if game is None or not game['completed']:issue('excluded_nonfinal_or_unknown_game',gameId=gid,dataset=kind);return None
  if number(r.get('season')) not in (year,(year-1)*10000+year):raise ValueError('Stats season mismatch')
  team=tid(r['team_id'])
  if team not in (game['homeTeamId'],game['awayTeamId']):raise ValueError('Stats opponent mismatch')
  if r.get('home_away') not in ('home','away') or (team==game['homeTeamId'])!=(r['home_away']=='home'):raise ValueError('Stats home/away mismatch')
  return game,team
 def stats(r,mapping):return {k:number(r.get(v),k=='plusMinus') for k,v in mapping.items()}
 for r in source['teams']:
  rel=relationship(r,'teams')
  if not rel:continue
  game,team=rel;key=(game['id'],team)
  if key in seen:raise ValueError('Duplicate team box score')
  seen.add(key);team_stats.append(dict(gameId=game['id'],teamId=team,group='team',statistics=stats(r,TEAM)))
 names={}
 for r in source['scoring']:
  if r.get('playerId') and r.get('firstName.default') and r.get('lastName.default'):names[pid(r['playerId'])]=r['firstName.default']+' '+r['lastName.default']
 for r in source['rosters']:
  if r.get('player_id') and r.get('full_name'):names[pid(r['player_id'])]=r['full_name']
 seen=set();benched=0
 for r in source['players']:
  rel=relationship(r,'players')
  if not rel:continue
  game,team=rel;player=pid(r['player_id']);goalie=r.get('position')=='G' or r.get('starter') is not None or r.get('goals_against') is not None or r.get('save_shots_against') is not None
  group='goalie' if goalie else 'skater';toi=seconds(r.get('toi'))
  identity=players.setdefault(player,dict(id=player,name=names.get(player) or r.get('player_name') or player,position='G' if goalie else r.get('position'),teamIds=[],gameIds=[]))
  if team not in identity['teamIds']:identity['teamIds'].append(team)
  # Dressing as a backup does not establish an appearance.
  if goalie and not ((toi or 0)>0 or (number(r.get('shots_against')) or 0)>0 or r.get('decision') in ('W','L','O')):benched+=1;continue
  key=(game['id'],team,player,group)
  if key in seen:raise ValueError('Duplicate player box score')
  seen.add(key)
  if game['id'] not in identity['gameIds']:identity['gameIds'].append(game['id'])
  values=stats(r,GOALIE if goalie else SKATER);values['toiSeconds']=toi
  if goalie:
   values['wins']=1 if r.get('decision')=='W' else 0 if r.get('decision') in ('L','O',None,'') else None
   values['overtimeLosses']=1 if r.get('decision')=='O' else 0 if r.get('decision') in ('W','L',None,'') else None
   values['losses']=1 if r.get('decision')=='L' else 0 if r.get('decision') in ('W','O',None,'') else None
   sa,sv,ga=(values[k] for k in ('shotsAgainst','saves','goalsAgainst'))
   if all(v is not None for v in (sa,sv,ga)) and sv+ga!=sa:
    issue('goalie_shots_conflict',gameId=game['id'],playerId=player,original=values.copy())
    for k in ('shotsAgainst','saves','goalsAgainst'):values[k]=None
  elif all(values[k] is not None for k in ('points','goals','assists')) and values['points']!=values['goals']+values['assists']:
   issue('skater_points_conflict',gameId=game['id'],playerId=player,original=values.copy());values['points']=None
  player_stats.append(dict(gameId=game['id'],teamId=team,playerId=player,group=group,statistics=values))
 # Scoring is a list of observed goals, not a fabricated play-by-play feed.
 schedule_so={str(r['game_id']):r.get('shootout') for r in source['schedule']}
 events={};shootouts={str(r['game_id']):r.get('has_shootout') for r in source['lines']}
 for r in source['scoring']:
  gid=str(r.get('game_id'));g=games.get(gid)
  if not g or not g['completed']:continue
  event=str(r.get('eventId'));key=(gid,event)
  if key in events:raise ValueError('Duplicate goal event')
  team=g['homeTeamId'] if r.get('isHome') is True else g['awayTeamId'] if r.get('isHome') is False else None
  if team is None:issue('goal_team_unknown',gameId=gid);continue
  row=dict(gameId=gid,eventId=event,teamId=team,playerName=' '.join(str(r.get(k) or '') for k in ('firstName.default','lastName.default')).strip() or r.get('name.default'),period=number(r.get('period_number')),periodType=r.get('period_type'),time=r.get('timeInPeriod'),strength=r.get('strength'))
  events[key]=row;scoring.append(row)
 bygame=collections.defaultdict(list)
 for r in scoring:bygame[r['gameId']].append(r)
 team_pairs={(r['gameId'],r['teamId']) for r in team_stats}
 for gid,g in games.items():
  rows=bygame[gid];home=sum(r['teamId']==g['homeTeamId'] for r in rows);away=sum(r['teamId']==g['awayTeamId'] for r in rows)
  complete=g['completed'] and g['homeScore'] is not None and g['awayScore'] is not None and home==g['homeScore'] and away==g['awayScore']
  g['scoringComplete']=complete
  if g['completed']:
   so_event=any(r['periodType']=='SO' for r in rows)
   if shootouts.get(gid) is True or schedule_so.get(gid) is True or so_event:
    g['finish']='SO'
    if shootouts.get(gid) is False or schedule_so.get(gid) is False:issue('shootout_flag_conflict',gameId=gid,scheduleFlag=schedule_so.get(gid),lineFlag=shootouts.get(gid),shootoutGoalEvent=so_event)
   elif complete:g['finish']='OT' if any(r['periodType']=='OT' for r in rows) else 'REG'
   if not complete:issue('goal_event_coverage_gap',gameId=gid)
  g['teamRows']=sum((gid,t) in team_pairs for t in (g['homeTeamId'],g['awayTeamId']))
 final=[g for g in games.values() if g['completed']];covered={r['gameId'] for r in team_stats};observed={r['gameId'] for r in player_stats}
 coverage=dict(season=year,scheduleGames=len(games),completedGames=len(final),teamBoxGames=len(covered),playerBoxGames=len(observed),missingTeamGames=sum(g['teamRows']<2 for g in final),missingPlayerGames=sum(g['id'] not in observed for g in final),unknownFinishes=sum(g['finish']=='Unknown' for g in final),excludedBackupRows=benched,reviewItems=len(review),issueCounts=dict(collections.Counter(r['code'] for r in review)),note='File coverage is not field completeness or official qualification. Names, teams and positions use season source records; no current-franchise remapping.')
 return dict(version=1,league='nhl',season=year,label=f'{year-1}–{str(year)[-2:]}',teams=sorted(teams.values(),key=lambda t:t['id']),players=sorted(players.values(),key=lambda p:p['id']),games=sorted(games.values(),key=lambda g:g['id']),teamStats=team_stats,playerStats=player_stats,scoring=sorted(scoring,key=lambda r:(r['gameId'],r['period'] or 999,r['time'] or '',r['eventId'])),coverage=coverage,review=review)

def verify(destination,year):
 pointer=destination/'seasons'/str(year)/'current.json';p=json.loads(pointer.read_text())
 if p.get('version')!=1 or p.get('league')!='nhl' or p.get('season')!=year or not re.fullmatch(r'\d{8}T\d{6}-[a-f0-9]{8}',p.get('runId','')):raise ValueError('Invalid NHL pointer')
 file=pointer.parent/'runs'/p['runId']/'season.json.gz'
 if file.resolve()!=file or sha(file)!=p['sha256']:raise ValueError('NHL archive path/hash mismatch')
 with gzip.open(file,'rt') as f:d=json.load(f)
 if d['season']!=year or d['league']!='nhl' or d['version']!=1:raise ValueError('NHL envelope mismatch')
 return p,file

def activate(destination,data):
 year=data['season'];folder=destination/'seasons'/str(year);folder.mkdir(parents=True,exist_ok=True)
 old=verify(destination,year) if (folder/'current.json').exists() else None
 run=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S')+'-'+uuid.uuid4().hex[:8];stage=folder/('building-'+run);stage.mkdir();target=None
 try:
  with gzip.open(stage/'season.json.gz','wt',encoding='utf-8',compresslevel=6) as f:json.dump(data,f,ensure_ascii=False,allow_nan=False,separators=(',',':'))
  digest=sha(stage/'season.json.gz');target=folder/'runs'/run;target.parent.mkdir(exist_ok=True);stage.replace(target)
  write(folder/'current.json',dict(version=1,league='nhl',season=year,runId=run,sha256=digest))
  if old:
   try:shutil.rmtree(old[1].parent)
   except OSError as error:print('New season active; previous cache could not be retired:',error)
 finally:
  if stage.exists():shutil.rmtree(stage)
  if target is not None and target.exists():
   try:active=json.loads((folder/'current.json').read_text()).get('runId')
   except FileNotFoundError:active=None
   if active!=run:shutil.rmtree(target)
 write(destination/'seasons.json',sorted(int(p.parent.name) for p in (destination/'seasons').glob('*/current.json')))

def fetch(url,path):
 for attempt in range(4):
  try:
   request=urllib.request.Request(url,headers={'User-Agent':'GamePulse-NHL-Collector/1.0'})
   with urllib.request.urlopen(request,timeout=90) as r:content=r.read()
   path.parent.mkdir(parents=True,exist_ok=True);tmp=path.with_suffix('.tmp');tmp.write_bytes(content);tmp.replace(path);return
  except Exception as error:
   if isinstance(error,urllib.error.HTTPError) and error.code==404:raise
   if attempt==3:raise
   time.sleep(1+attempt)

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--start',type=int,default=2025);p.add_argument('--end',type=int,default=2027);p.add_argument('--destination',type=Path,default=Path(__file__).resolve().parents[2]/'backend/GamePulse.Api/Data/processed/nhl');p.add_argument('--cache',type=Path,default=Path.home()/'Downloads/gamepulse-nhl-data');p.add_argument('--workers',type=int,default=4);p.add_argument('--refresh',action='store_true');p.add_argument('--keep-raw',action='store_true');p.add_argument('--offline',action='store_true');a=p.parse_args()
 if not 2010<=a.start<=a.end<=datetime.now().year+1 or not 1<=a.workers<=8:p.error('Use published ending years >= 2010 and 1–8 workers')
 try:import pyarrow.parquet as pq
 except ImportError:p.exit(1,'Install pyarrow in a virtual environment first: python3 -m pip install pyarrow\n')
 dest=a.destination.expanduser().resolve();cache=a.cache.expanduser().resolve()
 if dest.is_relative_to(cache) or cache.is_relative_to(dest):p.error('Keep cache and published data separate')
 dest.mkdir(parents=True,exist_ok=True);cache.mkdir(parents=True,exist_ok=True)
 with (dest/'.collector.lock').open('a') as lock:
  try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  except BlockingIOError:p.exit(1,'Another NHL import/collector is running\n')
  reports=[]
  for year in range(a.start,a.end+1):
   try:
    if (dest/'seasons'/str(year)/'current.json').exists() and not a.refresh:
     verify(dest,year);print(f'{year}: verified existing season; skipped',flush=True);reports.append(dict(season=year,status='retained'));continue
    if shutil.disk_usage(dest).free<512*1024**2:raise ValueError('Less than 512 MiB available; existing seasons retained')
    folder=cache/'raw'/str(year)
    def download(item):
     key,(tag,prefix)=item;path=folder/(prefix+str(year)+'.parquet')
     if not path.exists() or (a.refresh and not a.offline):
      if a.offline:
       if key in ('rosters','scoring','lines'):return key,[],dict(dataset=key,status='not_cached_offline')
       raise ValueError('Required offline file missing: '+str(path))
      try:fetch(f'https://github.com/sportsdataverse/sportsdataverse-data/releases/download/{tag}/{path.name}',path)
      except urllib.error.HTTPError as error:
       if error.code==404 and key in ('rosters','scoring','lines'):return key,[],dict(dataset=key,status='unavailable',url=error.url)
       raise
     return key,pq.read_table(path).to_pylist(),dict(dataset=key,url=f'https://github.com/sportsdataverse/sportsdataverse-data/releases/download/{tag}/{path.name}',sha256=sha(path))
    with concurrent.futures.ThreadPoolExecutor(a.workers) as pool:downloaded=list(pool.map(download,SOURCES.items()))
    data=prepare(year,{key:rows for key,rows,_ in downloaded})
    data['provenance']=dict(collectedAt=datetime.now(timezone.utc).isoformat(),source='SportsDataverse NHL releases (NHL Web API)',assets=[meta for _,_,meta in downloaded])
    report=cache/'reports'/f'{year}.json';write(report,dict(coverage=data['coverage'],review=data['review'],provenance=data['provenance']))
    activate(dest,data);verify(dest,year)
    if not a.keep_raw:shutil.rmtree(folder)
    reports.append(dict(season=year,status='imported',**{k:data['coverage'][k] for k in ('scheduleGames','completedGames','missingTeamGames','missingPlayerGames','reviewItems')}))
    print(f"{data['label']}: {len(data['games'])} games; {len(data['playerStats'])} player rows; {data['coverage']['reviewItems']} review items; compressed snapshot published",flush=True)
   except KeyboardInterrupt:raise
   except Exception as e:reports.append(dict(season=year,status='failed',error=str(e)));print(f'{year}: FAILED: {e}',flush=True)
  path=cache/'reports/coverage.csv';path.parent.mkdir(exist_ok=True)
  with path.open('w',newline='') as f:
   writer=csv.DictWriter(f,fieldnames=['season','status','scheduleGames','completedGames','missingTeamGames','missingPlayerGames','reviewItems','error']);writer.writeheader();writer.writerows(reports)
  print('Coverage report:',path)
  return 1 if any(r['status']=='failed' for r in reports) else 0
if __name__=='__main__':
 try:raise SystemExit(main())
 except KeyboardInterrupt:print('Stopped; published years retained. Rerun to resume.');raise SystemExit(130)
