#!/usr/bin/env python3
"""Compare NFL leaderboards with independently summed current snapshot rows."""
import argparse, collections, gc, gzip, json, math
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen
from urllib.error import HTTPError

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--api',default='http://localhost:5241');p.add_argument('--data',type=Path,default=Path('backend/GamePulse.Api/Data/processed/nfl'));args=p.parse_args()
    count=0
    def check(ok,label):
        nonlocal count
        assert ok,label;count+=1;print(f'PASS {count}: {label}',flush=True)
    def get(status=200,**q):
        try:
            with urlopen(args.api.rstrip('/')+'/api/leagues/nfl/leaderboards?'+urlencode(q),timeout=90) as r:code,raw=r.status,r.read()
        except HTTPError as e:code,raw=e.code,e.read()
        check(code==status,f'HTTP {status}: {q}');return json.loads(raw)
    groups={'passing':(['attempts','completions','passing_yards','passing_tds','passing_interceptions'],{'completionPercentage':('completions','attempts',100),'yardsPerAttempt':('passing_yards','attempts',1)}), 'rushing':(['carries','rushing_yards','rushing_tds','rushing_fumbles_lost'],{'yardsPerCarry':('rushing_yards','carries',1)}), 'receiving':(['targets','receptions','receiving_yards','receiving_tds','receiving_fumbles_lost'],{'yardsPerReception':('receiving_yards','receptions',1),'catchPercentage':('receptions','targets',100)})}
    def numeric(v,key):return isinstance(v,(int,float)) and not isinstance(v,bool) and math.isfinite(v) and v==int(v) and (v>=0 or key.endswith('_yards'))
    def oracle(rows,games,group,phase,team=None):
        keys,rates=groups[group];by=collections.defaultdict(list)
        for r in rows:
            if r['seasonType']==phase and games[r['gameId']]['status']=='final' and (team is None or r['teamId']==team):by[r['playerId']].append(r)
        result={}
        for pid,rs in by.items():
            if not any(numeric(r['stats'].get(k),k) and r['stats'][k]!=0 for r in rs for k in keys):continue
            totals={k:sum(r['stats'][k] for r in rs) if all(numeric(r['stats'].get(k),k) for r in rs) else None for k in keys}
            calculated={}
            for k,(num,den,scale) in rates.items():
                a,b=totals[num],totals[den];calculated[k]=scale*a/b if a is not None and b is not None and b>0 and (not k.endswith('Percentage') or a<=b) else None
            result[pid]=(totals,calculated,rs)
        return result
    manifests=sorted(args.data.glob('seasons/*/current.json'))
    for path in manifests:
        m=json.loads(path.read_text());year=m['season']
        def load(key):
            with gzip.open(args.data/m['files'][key]['path'],'rt') as f:return json.load(f)['data']
        rows=load('player_stats');games={g['gameId']:g for g in load('games')}
        for group,(keys,rates) in groups.items():
            metric=group+'_yards'
            for phase in ['REG','POST']:
                expected=oracle(rows,games,group,phase);d=get(season=year,group=group,seasonType=phase,pageSize=10)
                check(d['results']['total']==len(expected),f'{year} {phase} {group} eligible player count')
                known=sorted(((v[0][metric],pid) for pid,v in expected.items() if v[0][metric] is not None),key=lambda x:(-x[0],x[1]))
                check([r['playerId'] for r in d['results']['items'][:min(10,len(known))]]==[pid for _,pid in known[:10]],f'{year} {phase} {group} ordering')
                for r in d['results']['items']:
                    totals,calculated,observations=expected[r['playerId']]
                    check(r['totals']==totals and all((r['rates'][k] is None and v is None) or (r['rates'][k] is not None and v is not None and math.isclose(r['rates'][k],v,rel_tol=1e-12,abs_tol=1e-12)) for k,v in calculated.items()),f'{year} {phase} {group} {r["playerId"]} component totals/rates')
                    check(r['observations']==len(observations) and r['games']==len({x['gameId'] for x in observations}),f'{year} {phase} {group} observed coverage')
                if group=='passing' and phase=='REG' and d['results']['items']:
                    first=d['results']['items'][0]
                    filtered=get(season=year,search=first['name'],group=group)
                    check(next(x for x in filtered['results']['items'] if x['playerId']==first['playerId'])['rank']==first['rank'],f'{year} name search preserves rank')
                    team=first['teamIds'][0];team_data=get(season=year,group=group,teamId=team,search=first['name'])
                    selected=next(r for r in team_data['results']['items'] if r['playerId']==first['playerId'])
                    expected_team=oracle(rows,games,group,phase,team)[first['playerId']][0]
                    check(selected['totals']==expected_team and selected['teamIds']==[team],f'{year} team filter is a contribution filter')
        del rows,games;gc.collect()
    latest=max(int(p.parent.name) for p in manifests)
    for q in [dict(group='BAD'),dict(seasonType='ALL'),dict(metric='era'),dict(minOpportunities=-1),dict(page=0),dict(pageSize=101)]:get(status=400,season=latest,**q)
    get(status=404,season=latest,teamId='NO-TEAM')
    print(f'All {count} leaderboard API/source checks passed.')
if __name__=='__main__':main()
