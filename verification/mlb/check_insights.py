#!/usr/bin/env python3
"""Read-only HTTP checks against independently calculated source archive values."""
import argparse,json,urllib.request,urllib.error,urllib.parse,zipfile,math
from pathlib import Path

count=0

def check(ok,label):
    global count
    count+=1
    if not ok:raise AssertionError(label)


def main():
    p=argparse.ArgumentParser();p.add_argument('--data',type=Path,required=True);p.add_argument('--base',default='http://127.0.0.1:5241');p.add_argument('--seasons',nargs='+',type=int);a=p.parse_args()
    def api(path,**query):
        with urllib.request.urlopen(a.base+'/api/leagues/mlb/'+path+'?'+urllib.parse.urlencode(query),timeout=90) as response:return json.load(response)
    def fails(path,status,**query):
        try:api(path,**query)
        except urllib.error.HTTPError as e:check(e.code==status,f'Expected {status} at {path}, got {e.code}')
        else:raise AssertionError('Expected HTTP error '+path)
    pointer=json.loads((a.data/'current.json').read_text());runs=a.data/pointer['run'];examples=[]
    for year in (a.seasons or pointer['seasons']):
        with zipfile.ZipFile(runs/'seasons'/f'{year}.zip') as z:
            def read(name):return json.loads(z.read(name+'.json'))
            games=read('games');teams=read('teams');players=read('players');bat=read('batting')['rows'];pit=read('pitching')['rows']
            phases=['Regular Season','Playoffs']
            for phase in phases:
                analytics=api('analytics',season=year,seasonType=phase)
                check(len(analytics['teams'])==len(teams),'all teams represented')
                for r in analytics['teams']:
                    tid=r['team']['id'];selected=[g for g in games if g['seasonType']==phase and tid in (g['homeTeamId'],g['awayTeamId'])]
                    def expected(label,gs):
                        final=[g for g in gs if g['completed']];scored=[g for g in final if g['homeScore'] is not None and g['awayScore'] is not None]
                        own=lambda g:g['homeScore'] if tid==g['homeTeamId'] else g['awayScore']
                        opp=lambda g:g['awayScore'] if tid==g['homeTeamId'] else g['homeScore']
                        w=sum(own(g)>opp(g) for g in scored);l=sum(own(g)<opp(g) for g in scored)
                        complete=bool(final) and len(final)==len(scored)
                        rf=sum(own(g) for g in scored) if complete else None;ra=sum(opp(g) for g in scored) if complete else None
                        return dict(label=label,scheduledGames=len(gs),completedGames=len(final),scoredGames=len(scored),wins=w,losses=l,ties=sum(own(g)==opp(g) for g in scored),winPercentage=w/(w+l) if w+l else None,runsFor=rf,runsAgainst=ra,runDifferential=rf-ra if complete else None,runsPerGame=rf/len(final) if complete else None,missingScoreGames=len(final)-len(scored))
                    check(r['record']==expected('Season',selected),f'{year} {tid} season scores')
                    check(r['homeAway']==[expected('Home',[g for g in selected if g['homeTeamId']==tid]),expected('Away',[g for g in selected if g['awayTeamId']==tid])],'home-away')
                    check(r['months']==[expected(m,[g for g in selected if g['officialDate'].startswith(m)]) for m in sorted({g['officialDate'][:7] for g in selected})],'month grouping')
                    for key,source in [('batting',bat),('pitching',pit)]:
                        original=next((s for s in source if s['kind']=='team' and s['id']==tid and s['seasonType']==phase),None)
                        if original:
                            for k in ('totals','rates','observedRows','games','observationRows'):check(r[key][k]==original[k],f'{key} summary {k}')
                        else:check(r[key] is None,'missing team summary remains null')
                    check(r['missingBattingGames']==max(0,r['record']['completedGames']-(r['batting'] or {}).get('games',0)),'batting missing games')
                    check(r['missingPitchingGames']==max(0,r['record']['completedGames']-(r['pitching'] or {}).get('games',0)),'pitching missing games')
            candidates=sorted(players,key=lambda p:-len(p['gameIds']))[:3]
            traded=next((p for p in players if len(p['teamIds'])>1),None)
            twoway=next((p for p in players if any(r['id']==p['id'] and r['teamId'] is None for r in bat) and any(r['id']==p['id'] and r['teamId'] is None for r in pit)),None)
            roster=next((p for p in players if not p['gameIds']),None)
            for extra in (traded,twoway,roster):
                if extra and extra not in candidates:candidates.append(extra)
            for player in candidates:
                pid=player['id'];examples.append((year,pid))
                for phase in phases:
                    profile=api(f'players/{pid}/season-profile',season=year,seasonType=phase)
                    for key,source in [('batting',bat),('pitching',pit)]:
                        rows=[s for s in source if s['kind']=='player' and s['id']==pid and s['seasonType']==phase]
                        original=next((s for s in rows if s['teamId'] is None),None)
                        if original:
                            for k in ('totals','rates','observedRows','games','observationRows'):check(profile[key][k]==original[k],f'{pid} {key} {k}')
                        else:check(profile[key] is None,'no profile stats invented')
                        check(len(profile[key+'Teams'])==sum(r['teamId'] is not None for r in rows),'contribution rows')
                    log=api(f'players/{pid}/game-log',season=year,seasonType=phase,pageSize=3)['results']
                    eligible=sorted([g for g in games if g['id'] in player['gameIds'] and g['completed'] and g['seasonType']==phase],key=lambda g:(g['officialDate'],g.get('gameNumber') or 0),reverse=True)
                    check(log['total']==len(eligible),'log metadata count')
                    check(len(log['items'])==min(3,len(eligible)),'log page size')
                    for item in log['items']:
                        original=read('game_stats/'+item['game']['sourceId'])
                        check(item['statistics']==[s for s in original['playerStatistics'] if s['playerId']==pid],'exact source log rows')
                if player['teamIds']:
                    tid=player['teamIds'][0]
                    profile=api(f'players/{pid}/season-profile',season=year,teamId=tid)
                    for key,source in [('batting',bat),('pitching',pit)]:
                        row=next((s for s in source if s['kind']=='player' and s['id']==pid and s['seasonType']=='Regular Season' and s['teamId']==tid),None)
                        check((profile[key] or {}).get('totals')==(row or {}).get('totals'),'selected contribution totals')
                    log=api(f'players/{pid}/game-log',season=year,teamId=tid,pageSize=3)['results']
                    for item in log['items']:check(all(s['teamId']==tid for s in item['statistics']),'log team contribution filter')
            check(api(f'teams/{teams[0]["sourceId"]}/analytics',season=year)['team']['id']==teams[0]['id'],'source ID alias')
            check(api(f'players/{players[0]["sourceId"]}/season-profile',season=year)['player']['id']==players[0]['id'],'player alias')
            # Existing core routes still return their original response envelopes.
            check(isinstance(api('batting',season=year)['results']['items'],list),'existing batting route')
            check(isinstance(api('pitching',season=year)['results']['items'],list),'existing pitching route')
            check(len(api('standings',season=year)['teams'])==len(teams),'existing standings route')
    leftYear,leftId=examples[0];rightYear,rightId=examples[-1]
    for group in ('batting','pitching'):
        c=api('compare',leftId=leftId,rightId=rightId,leftSeason=leftYear,rightSeason=rightYear,group=group)
        l=c['left'][group];r=c['right'][group]
        for k,v in c['differences'].items():
            lv=next((l[key][k] for key in ('totals','rates') if l and k in l[key]),None);rv=next((r[key][k] for key in ('totals','rates') if r and k in r[key]),None)
            wanted=None if lv is None or rv is None else lv-rv
            check(v==wanted or v is not None and wanted is not None and math.isclose(v,wanted,abs_tol=1e-12),'comparison delta')
    fails('analytics',400,season=1935,seasonType='invalid')
    fails('analytics',404,season=1800)
    fails('players/no-such-player/season-profile',404,season=1935)
    fails(f'players/{leftId}/game-log',400,season=leftYear,page=0)
    fails(f'players/{leftId}/game-log',400,season=leftYear,pageSize=101)
    fails(f'players/{leftId}/season-profile',404,season=leftYear,teamId='unknown')
    fails('compare',400,leftId=leftId,rightId=rightId,leftSeason=leftYear,rightSeason=rightYear,group='fielding')
    print(f'{count} MLB API/source assertions passed')

if __name__=='__main__':main()
