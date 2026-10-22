"""Compact batting aggregates. Missing observations never become zero."""
from collections import defaultdict

COUNTS = ('plateAppearances','atBats','runs','hits','doubles','triples','homeRuns','rbi',
          'baseOnBalls','strikeOuts','stolenBases','hitByPitch','sacFlies','totalBases')
RATES = {'avg':('hits','atBats'), 'obp':('hits','baseOnBalls','hitByPitch','atBats','sacFlies'),
         'slg':('totalBases','atBats'), 'ops':('hits','baseOnBalls','hitByPitch','atBats','sacFlies','totalBases')}

class Aggregate:
 def __init__(self):
  self.games=set();self.teams=set();self.rows=0;self.sums=defaultdict(int);self.observed=defaultdict(int)
 def add(self,row):
  self.games.add(row['gameId']);self.teams.add(row['teamId']);self.rows+=1;s=dict(row['statistics'])
  # Derive total bases only when every component is present and internally valid.
  if s.get('totalBases') is None and all(s.get(k) is not None for k in ('hits','doubles','triples','homeRuns')):
   if s['hits']>=s['doubles']+s['triples']+s['homeRuns']:
    s['totalBases']=s['hits']+s['doubles']+2*s['triples']+3*s['homeRuns']
  for k in COUNTS:
   v=s.get(k)
   if v is not None:
    if isinstance(v,bool) or not isinstance(v,(int,float)) or v<0 or int(v)!=v:raise ValueError('Batting count must be a nonnegative integer: '+k)
    self.sums[k]+=int(v);self.observed[k]+=1
  if s.get('hits') is not None and s.get('atBats') is not None and s['hits']>s['atBats']:raise ValueError('Batting hits exceed at-bats')
 def result(self,kind,identity,phase,team):
  totals={k:self.sums[k] if self.observed[k]==self.rows else None for k in COUNTS}
  rates={}
  for key,components in RATES.items():
   if any(totals[k] is None for k in components):rates[key]=None;continue
   ab=totals['atBats'];obden=ab+(totals['baseOnBalls'] or 0)+(totals['hitByPitch'] or 0)+(totals['sacFlies'] or 0)
   avg=totals['hits']/ab if key=='avg' and ab else None
   obp=(totals['hits']+totals['baseOnBalls']+totals['hitByPitch'])/obden if key in ('obp','ops') and obden else None
   slg=totals['totalBases']/ab if key in ('slg','ops') and ab else None
   rates[key]={'avg':avg,'obp':obp,'slg':slg,'ops':obp+slg if obp is not None and slg is not None else None}[key]
  return dict(kind=kind,id=identity,seasonType=phase,teamId=team,teamIds=sorted(self.teams),games=len(self.games),
              observationRows=self.rows,totals=totals,rates=rates,observedRows={k:self.observed[k] for k in COUNTS})

def build_batting(parts,season):
 groups={}
 for part in parts.values():
  for kind,key in [('team','teamStatistics'),('player','playerStatistics')]:
   for row in part[key]:
    if row['group']!='batting':continue
    identity=row['teamId'] if kind=='team' else row['playerId']
    for team in ([row['teamId']] if kind=='team' else [None,row['teamId']]):
     group=(kind,identity,row['seasonType'],team)
     if group not in groups:groups[group]=Aggregate()
     groups[group].add(row)
 return dict(version=1,season=season,rows=[groups[k].result(*k) for k in sorted(groups,key=lambda k:tuple(x or '' for x in k))])
