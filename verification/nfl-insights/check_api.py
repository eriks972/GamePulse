#!/usr/bin/env python3
"""Read-only NFL insights checks against source snapshots; stdlib only."""
import argparse,gzip,json,math,urllib.request,urllib.parse,urllib.error
from pathlib import Path
count=0
DEFS={'passing':(['attempts','completions','passing_yards','passing_tds','passing_interceptions'],{'completionPercentage':('completions','attempts',100),'yardsPerAttempt':('passing_yards','attempts',1)}),'rushing':(['carries','rushing_yards','rushing_tds','rushing_fumbles_lost'],{'yardsPerCarry':('rushing_yards','carries',1)}),'receiving':(['targets','receptions','receiving_yards','receiving_tds','receiving_fumbles_lost'],{'yardsPerReception':('receiving_yards','receptions',1),'catchPercentage':('receptions','targets',100)})}
def check(ok,label):
 global count
 count+=1
 if not ok:raise AssertionError(label)
def known(r,k):
 v=r['stats'].get(k)
 return int(v) if isinstance(v,(int,float)) and not isinstance(v,bool) and math.isfinite(v) and int(v)==v and (v>=0 or k.endswith('_yards')) else None

def verify_summary(summary,rows,group):
 keys,rates=DEFS[group]
 active=any(known(r,k) not in (None,0) for r in rows for k in keys)
 if not rows or not active:check(summary is None,'No invented category activity');return
 check(summary is not None,'Activity summary exists')
 totals={k:sum(known(r,k) for r in rows) if all(known(r,k) is not None for r in rows) else None for k in keys}
 check(summary['totals']==totals,'Exact strict totals')
 check(summary['fieldObservations']=={k:sum(known(r,k) is not None for r in rows) for k in keys},'Field coverage')
 check(summary['games']==len({r['gameId'] for r in rows}) and summary['observations']==len(rows),'Distinct game / row counts')
 check(summary['rank'] is None and summary['value'] is None,'No global rank assigned to a profile')
 for k,(n,d,scale) in rates.items():
  expected=scale*totals[n]/totals[d] if totals[n] is not None and totals[d] is not None and totals[d]>0 and (k not in ('completionPercentage','catchPercentage') or totals[n]<=totals[d]) else None
  value=summary['rates'][k];check(value==expected or value is not None and expected is not None and math.isclose(value,expected,abs_tol=1e-12),'Rate recomputed from totals')

def main():
 p=argparse.ArgumentParser();p.add_argument('--data',type=Path,required=True);p.add_argument('--api',default='http://127.0.0.1:5241');p.add_argument('--seasons',nargs='+',type=int);a=p.parse_args()
 def api(path,**q):
  with urllib.request.urlopen(a.api+'/api/leagues/nfl/'+path+'?'+urllib.parse.urlencode(q),timeout=90) as f:return json.load(f)
 def fails(path,status,**q):
  try:api(path,**q)
  except urllib.error.HTTPError as e:check(e.code==status,'Expected status '+str(status))
  else:raise AssertionError('Expected HTTP error')
 years=a.seasons or [int(p.parent.name) for p in sorted((a.data/'seasons').glob('*/current.json'))];examples=[];passing_examples=[]
 for year in years:
  m=json.loads((a.data/f'seasons/{year}/current.json').read_text())
  def read(k):
   with gzip.open(a.data/m['files'][k]['path'],'rt') as f:return json.load(f)['data']
  teams=read('teams');games=read('games');game_index={g['gameId']:g for g in games};source=read('team_stats');players=read('players');player_rows=read('player_stats')
  for phase in ('REG','POST'):
   report=api('analytics',season=year,seasonType=phase);check(len(report['teams'])==len(teams),'All teams returned')
   for t in report['teams']:
    tid=t['team']['teamId'];selected=[g for g in games if g['seasonType']==phase and tid in (g['homeTeamId'],g['awayTeamId'])];final=[g for g in selected if g['status']=='final'];scored=[g for g in final if g['homeScore'] is not None and g['awayScore'] is not None]
    own=lambda g:g['homeScore'] if g['homeTeamId']==tid else g['awayScore'];opp=lambda g:g['awayScore'] if g['homeTeamId']==tid else g['homeScore']
    w=sum(own(g)>opp(g) for g in scored);l=sum(own(g)<opp(g) for g in scored);ties=sum(own(g)==opp(g) for g in scored);r=t['record']
    check((r['wins'],r['losses'],r['ties'])==(w,l,ties),'Scored W L T')
    check(r['winPercentage']==((w+ties/2)/len(scored) if scored else None),'Tie-aware win percentage')
    complete=bool(final) and len(final)==len(scored);pf=sum(own(g) for g in scored) if complete else None;pa=sum(opp(g) for g in scored) if complete else None
    check(r['pointsFor']==pf and r['pointsAgainst']==pa and r['differential']==(pf-pa if complete else None),'Independent scored totals')
    check(sum(x['completedGames'] for x in t['homeAway'])==len(final),'Home-away games')
    check(sum(x['record']['completedGames'] for x in t['weeks'])==len(final),'Weekly totals')
    eligible=[row for row in source if row['seasonType']==phase and game_index[row['gameId']]['status']=='final']
    own_rows=[row for row in eligible if row['teamId']==tid];opp_rows=[row for row in eligible if row['opponentTeamId']==tid]
    check(t['observedTeamGames']==len({r['gameId'] for r in own_rows}),'Own observation coverage')
    check(t['observedOpponentGames']==len({r['gameId'] for r in opp_rows}),'Opponent observation coverage')
    for group in DEFS:verify_summary(t['offense'][group],own_rows,group);verify_summary(t['opponents'][group],opp_rows,group)
  # Leaders provide representative active players; source-derived edge cases add trades and roster-only identities.
  ids=[]
  for group in DEFS:
   leaders=api('leaderboards',season=year,group=group,pageSize=3)['results']['items'];ids.extend(r['playerId'] for r in leaders)
  ids+= [p['playerId'] for p in players if len(p['teamIds'])>1][:2]
  active={r['playerId'] for r in player_rows};ids += [p['playerId'] for p in players if p['playerId'] not in active][:1]
  for pid in dict.fromkeys(ids):
   examples.append((year,pid))
   for phase in ('REG','POST'):
    d=api('players/'+pid+'/season-profile',season=year,seasonType=phase);rows=[r for r in player_rows if r['playerId']==pid and r['seasonType']==phase and game_index[r['gameId']]['status']=='final']
    for group in DEFS:verify_summary(d['groups'][group],rows,group)
    log=api('players/'+pid+'/season-log',season=year,seasonType=phase,pageSize=3)
    check(log['total']==len({r['gameId'] for r in rows}),'Log exact appearance count')
    for item in log['items']:check(item['statistics']==[r for r in rows if r['gameId']==item['game']['gameId']],'Exact log source rows')
   d=api('players/'+pid+'/season-profile',season=year)
   if d['player']['teamIds']:
    tid=d['player']['teamIds'][0];filtered=api('players/'+pid+'/season-profile',season=year,teamId=tid)
    rows=[r for r in player_rows if r['playerId']==pid and r['teamId']==tid and r['seasonType']=='REG' and game_index[r['gameId']]['status']=='final']
    for group in DEFS:verify_summary(filtered['groups'][group],rows,group)
  for g in DEFS:
   entries=api('leaderboards',season=year,group=g,pageSize=1)['results']['items']
   if entries:
    if g=='passing':passing_examples.append((year,entries[0]['playerId']))
    e=entries[0];d=api('players/'+e['playerId']+'/season-profile',season=year)
    for key in ('totals','rates','fieldObservations','games','observations','teamContributions'):check(d['groups'][g][key]==e[key],'Leader/profile calculation parity')
  first=teams[0]['teamId'];single=api('teams/'+first+'/analytics',season=year);check(single['analytics']['team']['teamId']==first,'Team detail endpoint')
 left=passing_examples[0];right=passing_examples[-1]
 for group in DEFS:
  c=api('compare',leftId=left[1],rightId=right[1],leftSeason=left[0],rightSeason=right[0],group=group)
  for k,diff in c['differences'].items():
   l=c['left']['groups'][group];r=c['right']['groups'][group];lv=(l['totals'].get(k) if k in l['totals'] else l['rates'].get(k)) if l else None;rv=(r['totals'].get(k) if k in r['totals'] else r['rates'].get(k)) if r else None
   expected=lv-rv if lv is not None and rv is not None else None;check(diff==expected,'A minus B and unknown differences')
 fails('analytics',400,season=years[0],seasonType='PRE');fails('compare',400,leftId=left[1],rightId=right[1],leftSeason=left[0],rightSeason=right[0],group='defense');fails('players/unknown/season-profile',404,season=years[0]);fails('players/'+left[1]+'/season-log',400,season=left[0],page=0);fails('teams/unknown/analytics',404,season=years[0]);fails('players/'+left[1]+'/season-profile',404,season=left[0],teamId='not-a-team')
 print(f'{count} NFL insights HTTP/source assertions passed')
if __name__=='__main__':main()
