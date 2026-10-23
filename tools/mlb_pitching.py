"""Pitching season aggregates. Innings are summed as outs; missing is not zero."""
import re
from collections import defaultdict

COUNTS=('outsRecorded','gamesStarted','wins','losses','saves','holds','blownSaves',
        'hits','runs','earnedRuns','homeRuns','baseOnBalls','strikeOuts','hitBatsmen',
        'battersFaced','numberOfPitches','wildPitches','balks')
RATES={'era':('earnedRuns','outsRecorded'),'whip':('hits','baseOnBalls','outsRecorded'),
       'kPer9':('strikeOuts','outsRecorded'),'bbPer9':('baseOnBalls','outsRecorded'),
       'hPer9':('hits','outsRecorded'),'hrPer9':('homeRuns','outsRecorded'),
       'kToBb':('strikeOuts','baseOnBalls')}

def innings_to_outs(value):
 if not isinstance(value,str) or not re.fullmatch(r'\d+(?:\.[012])?',value):raise ValueError('Use innings and outs notation, e.g. 5.2; never decimal innings')
 whole,_,fraction=value.partition('.')
 return int(whole)*3+int(fraction or '0')

def outs_to_innings(value):return None if value is None else f'{value//3}.{value%3}'

def rate(totals,key):
 if any(totals[k] is None for k in RATES[key]):return None
 if key=='kToBb':
  return totals['strikeOuts']/totals['baseOnBalls'] if totals['baseOnBalls'] else None
 outs=totals['outsRecorded']
 if not outs:return None
 if key=='whip':return 3*(totals['hits']+totals['baseOnBalls'])/outs
 numerator={'era':'earnedRuns','kPer9':'strikeOuts','bbPer9':'baseOnBalls','hPer9':'hits','hrPer9':'homeRuns'}[key]
 return 27*totals[numerator]/outs

class Aggregate:
 def __init__(self):self.games=set();self.teams=set();self.rows=0;self.sums=defaultdict(int);self.observed=defaultdict(int)
 def add(self,row):
  s=dict(row['statistics']);ip=s.get('inningsPitched');outs=s.get('outsRecorded')
  if outs is not None and (isinstance(outs,bool) or not isinstance(outs,(int,float)) or outs<0 or int(outs)!=outs):raise ValueError('Invalid outsRecorded')
  if ip is not None:
   parsed=innings_to_outs(ip)
   if outs is not None and outs!=parsed:raise ValueError('Pitching outsRecorded disagrees with inningsPitched')
   s['outsRecorded']=parsed
  for key in COUNTS:
   value=s.get(key)
   if value is not None:
    if isinstance(value,bool) or not isinstance(value,(int,float)) or value<0 or int(value)!=value:raise ValueError('Pitching count must be a nonnegative integer: '+key)
    self.sums[key]+=int(value);self.observed[key]+=1
  if s.get('earnedRuns') is not None and s.get('runs') is not None and s['earnedRuns']>s['runs']:raise ValueError('Earned runs exceed pitching runs')
  self.rows+=1;self.games.add(row['gameId']);self.teams.add(row['teamId'])
 def result(self,kind,identity,phase,team):
  totals={k:self.sums[k] if self.observed[k]==self.rows else None for k in COUNTS}
  return dict(kind=kind,id=identity,seasonType=phase,teamId=team,teamIds=sorted(self.teams),games=len(self.games),observationRows=self.rows,
              totals=totals,inningsPitched=outs_to_innings(totals['outsRecorded']),rates={k:rate(totals,k) for k in RATES},observedRows={k:self.observed[k] for k in COUNTS})

def build_pitching(parts,season):
 groups={}
 for part in parts.values():
  for kind,key in [('team','teamStatistics'),('player','playerStatistics')]:
   for row in part[key]:
    if row['group']!='pitching':continue
    identity=row['teamId'] if kind=='team' else row['playerId']
    for team in ([row['teamId']] if kind=='team' else [None,row['teamId']]):
     group=(kind,identity,row['seasonType'],team)
     if group not in groups:groups[group]=Aggregate()
     groups[group].add(row)
 return dict(version=1,season=season,rows=[groups[k].result(*k) for k in sorted(groups,key=lambda k:tuple(x or '' for x in k))])
