#!/usr/bin/env python3
"""Independently check NHL API aggregates against published snapshot observations."""
import argparse,gzip,json,math,urllib.request,urllib.parse,urllib.error
from pathlib import Path
count=0

def check(ok,label):
 global count
 count+=1
 if not ok:raise AssertionError(label)

def main():
 p=argparse.ArgumentParser();p.add_argument('--data',type=Path,required=True);p.add_argument('--base',default='http://127.0.0.1:5241');a=p.parse_args()
 def api(path,**q):
  with urllib.request.urlopen(a.base+'/api/leagues/nhl/'+path+'?'+urllib.parse.urlencode(q),timeout=90) as r:return json.load(r)
 def fails(path,status,**q):
  try:api(path,**q)
  except urllib.error.HTTPError as e:check(e.code==status,'Expected HTTP '+str(status))
  else:raise AssertionError('Expected HTTP error')
 years=api('seasons');check(len(years)>=2,'Published seasons');examples=[]
 for year in years:
  folder=a.data/'seasons'/year;pointer=json.loads((folder/'current.json').read_text())
  with gzip.open(folder/'runs'/pointer['runId']/'season.json.gz','rt') as f:d=json.load(f)
  games={g['id']:g for g in d['games']};
  for event in d['scoring']:
   if event['periodType']=='SO':check(games[event['gameId']]['finish']=='SO','Shootout goal evidence overrides line flag')
  check(len(api('teams',season=year))==len(d['teams']),'Team count')
  for phase in ('Regular Season','Playoffs'):
   report=api('analytics',season=year,seasonType=phase);check(len(report['teams'])==len(d['teams']),'All analytics teams')
   for r in report['teams']:
    team=r['team']['id'];selected=[g for g in games.values() if g['seasonType']==phase and team in (g['homeTeamId'],g['awayTeamId'])];final=[g for g in selected if g['completed']];scored=[g for g in final if g['homeScore'] is not None and g['awayScore'] is not None]
    own=lambda g:g['homeScore'] if g['homeTeamId']==team else g['awayScore'];opp=lambda g:g['awayScore'] if g['homeTeamId']==team else g['homeScore']
    w=sum(own(g)>opp(g) for g in scored);l=sum(own(g)<opp(g) and g['finish']=='REG' for g in scored);o=sum(own(g)<opp(g) and g['finish'] in ('OT','SO') for g in scored);unknown=len(final)-w-l-o
    check(r['record']['wins']==w and r['record']['regulationLosses']==l and r['record']['overtimeLosses']==o,'W L OTL')
    points=2*w+o if not unknown and phase=='Regular Season' else None
    check(r['record']['points']==points,'Standings points')
    check(r['record']['scheduledGames']==len(selected) and r['record']['completedGames']==len(final),'Scheduled/final coverage')
    for side in ('Home','Away'):
     split=next(x for x in r['homeAway'] if x['label']==side);check(split['completedGames']==sum((g['homeTeamId']==team)==(side=='Home') for g in final),'Home away groups')
    check(sum(m['completedGames'] for m in r['months'])==len(final),'Monthly totals')
    rows=[s for s in d['teamStats'] if s['teamId']==team and games[s['gameId']]['seasonType']==phase]
    if rows:
     for k,v in r['statistics']['totals'].items():
      vals=[s['statistics'].get(k) for s in rows];expected=sum(vals) if all(x is not None for x in vals) else None;check(v==expected,'Team strict totals')
    else:check(r['statistics'] is None,'Empty team observations')
  # Each eligible player is independently verified across both group types.
  for group in ('skater','goalie'):
   stats=api('statistics',season=year,group=group,pageSize=100);check(stats['results']['pageSize']==100,'Leader page size')
   for entry in stats['results']['items'][:12]:
    s=entry['summary'];pid=s['id'];rows=[r for r in d['playerStats'] if r['playerId']==pid and r['group']==group and games[r['gameId']]['seasonType']=='Regular Season'];check(s['games']==len({r['gameId'] for r in rows}),'Player distinct games')
    for k,v in s['totals'].items():
     vals=[r['statistics'].get(k) for r in rows];expected=sum(vals) if all(v is not None for v in vals) else None;check(v==expected,'Player strict totals');check(s['observedRows'][k]==sum(v is not None for v in vals),'Player coverage')
    if group=='goalie':
     t=s['totals'];sv=t['saves']/t['shotsAgainst'] if t['saves'] is not None and t['shotsAgainst'] else None;gaa=t['goalsAgainst']*3600/t['toiSeconds'] if t['goalsAgainst'] is not None and t['toiSeconds'] else None
     check(s['rates']['savePercentage']==sv and s['rates']['gaa']==gaa,'Goalie rates from totals')
   if stats['results']['items']:
    entry=stats['results']['items'][0];pid=entry['summary']['id'];examples.append((year,pid,group));profile=api('players/'+pid,season=year);check(profile[group]==entry['summary'],'Profile and leaders consistent')
    log=api('players/'+pid+'/games',season=year,pageSize=3);check(len(log['items'])<=3,'Log paging')
    for item in log['items']:
     expected=[r for r in d['playerStats'] if r['playerId']==pid and r['gameId']==item['game']['id']];check(item['statistics']==expected,'Exact game log source rows')
    team=profile['player']['teamIds'][0];filtered=api('players/'+pid,season=year,teamId=team);check(all(t==team for t in (filtered[group] or {}).get('teamIds',[])),'Contribution filter')
   fails('statistics',400,season=year,group=group,minGames=-1)
  gid=next(g['id'] for g in games.values() if g['completed']);game=api('games/'+gid,season=year);check(len(game['teamStats'])==sum(r['gameId']==gid for r in d['teamStats']),'Game team box rows')
  check(game['playerStats']==[r for r in d['playerStats'] if r['gameId']==gid],'Game player box rows')
  future=next((g for g in games.values() if not g['completed']),None)
  if future:check(not api('games/'+future['id'],season=year)['playerStats'],'No future game stats invented')
  standings=api('standings',season=year);check(len(standings['teams'])==len(d['teams']),'Standings team count')
 left=examples[0];right=examples[-2] if len(examples)>2 else examples[-1];comp=api('compare',leftId=left[1],rightId=right[1],leftSeason=left[0],rightSeason=right[0]);check(str(comp['left']['season'])==left[0] and str(comp['right']['season'])==right[0],'Cross-season comparison')
 fails('statistics',400,season=years[0],metric='not-real');fails('games',400,season=years[0],page=0);fails('games',400,season=years[0],date='bad');fails('analytics',400,season=years[0],seasonType='bad');fails('players/no-such-player',404,season=years[0]);fails('games/0000',404,season=years[0]);fails('teams/no-team',404,season=years[0]);fails('coverage',404,season=1900)
 print(f'{count} NHL HTTP/source assertions passed')
if __name__=='__main__':main()
