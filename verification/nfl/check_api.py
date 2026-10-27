#!/usr/bin/env python3
"""Compare the running NFL API with current published gzip snapshots (stdlib only)."""
import argparse
import gzip
import hashlib
import json
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlencode, quote
from urllib.request import urlopen


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--api', default='http://localhost:5241')
    parser.add_argument('--data', type=Path, default=Path('backend/GamePulse.Api/Data/processed/nfl'))
    args = parser.parse_args()
    count = 0

    def check(condition, label):
        nonlocal count
        assert condition, label
        count += 1
        print(f'PASS {count}: {label}', flush=True)

    def get(path, expected_status=200, **query):
        url = args.api.rstrip('/') + '/api/leagues/nfl/' + path + '?' + urlencode(query)
        try:
            with urlopen(url, timeout=90) as r:
                code, body = r.status, r.read()
        except HTTPError as e:
            code, body = e.code, e.read()
        check(code == expected_status, f'{path} {query}: HTTP {expected_status}')
        return json.loads(body)

    manifests = [json.loads(p.read_text()) for p in args.data.glob('seasons/*/current.json')]
    check(bool(manifests), 'Current NFL manifests exist')
    available = get('seasons')
    check([m['season'] for m in available] == sorted([m['season'] for m in manifests], reverse=True), 'Available years match authoritative current manifests')
    fractional_tested = False
    tie_tested = False
    january_tested = False
    unplayed_tested = False
    roster_only_tested = False
    for m in sorted(manifests, key=lambda m: m['season']):
        year = m['season']
        data = {}
        for key, f in m['files'].items():
            raw = (args.data / f['path']).read_bytes()
            check(len(raw) == f['bytes'] and hashlib.sha256(raw).hexdigest() == f['sha256'], f'{year} {key} compressed integrity')
            envelope = json.loads(gzip.decompress(raw))
            check(envelope['season'] == year and envelope['count'] == len(envelope['data']) == f['count'], f'{year} {key} envelope/count')
            data[key] = envelope['data']
        coverage = get('coverage', season=year)
        check(coverage['coverage'] == m['coverage'] and coverage['runId'] == m['runId'], f'{year} coverage uses current run')
        check(get('teams', season=year) == sorted(data['teams'], key=lambda t: t['name']) or
              [{k: t.get(k) for k in ('teamId','name','conference','division','color','logoUrl')} for t in get('teams', season=year)] ==
              [{k: t.get(k) for k in ('teamId','name','conference','division','color','logoUrl')} for t in sorted(data['teams'], key=lambda t:t['name'])], f'{year} team metadata')
        games = get('games', season=year, seasonType='REG', week=1, pageSize=100)
        expected = [g for g in data['games'] if g['seasonType'] == 'REG' and g['week'] == 1]
        check(games['total'] == len(expected) and {g['gameId'] for g in games['items']} == {g['gameId'] for g in expected}, f'{year} regular week filter')
        for phase in ('REG', 'POST'):
            standings = get('standings', season=year, seasonType=phase)
            source = {r['teamId']: r for r in data['records'] if r['seasonType'] == phase}
            check(all(r['record'] == source.get(r['team']['teamId']) for r in standings['teams']), f'{year} {phase} records preserve source phase')
            check(all(r['winPercentage'] == ((r['record']['wins'] + r['record']['ties'] / 2) / r['record']['played'] if r['record'] and r['record']['played'] else None) for r in standings['teams']), f'{year} {phase} win percentage handles ties')
        first = data['player_stats'][0]
        player = get('players/' + quote(first['playerId']), season=year)
        wanted = [r for r in data['player_stats'] if r['playerId'] == first['playerId']]
        check({(r['gameId'],r['teamId']):r['stats'] for r in player['statistics']} == {(r['gameId'],r['teamId']):r['stats'] for r in wanted}, f'{year} player weekly fields, nulls, and zero preserved')
        check({g['gameId'] for g in player['games']} == {r['gameId'] for r in wanted}, f'{year} player game associations')
        directory = get('players', season=year, search=player['player']['name'], pageSize=100)
        check(any(p['playerId'] == first['playerId'] for p in directory['items']), f'{year} player search')
        team = data['teams'][0]
        detail = get('teams/' + team['teamId'], season=year)
        check(len(detail['rosters']) == sum(r['teamId'] == team['teamId'] for r in data['rosters']), f'{year} roster associations')
        check(len(detail['statistics']) == sum(r['teamId'] == team['teamId'] for r in data['team_stats']), f'{year} team weekly stats')
        for kind in ('team','player'):
            stats = get('statistics', season=year, kind=kind, seasonType='REG', week=1, statGroup='passing', pageSize=100)
            cols = ['completions','attempts','passing_yards','passing_tds','passing_interceptions','sacks_suffered']
            selected = [r for r in data[kind+'_stats'] if r['seasonType']=='REG' and r['week']==1 and any(isinstance(r['stats'].get(k),(int,float)) and r['stats'][k]!=0 for k in cols)]
            check(stats['total'] == len(selected), f'{year} {kind} category activity filter')
            check({(r['gameId'],r['teamId'],r['playerId']):r['stats'] for r in stats['items']} == {(r['gameId'],r['teamId'],r.get('playerId')):r['stats'] for r in selected}, f'{year} {kind} weekly stats are source values')
        if not fractional_tested:
            half = next((r for r in data['player_stats'] if isinstance(r['stats'].get('def_sacks'),(int,float)) and r['stats']['def_sacks'] % 1), None)
            if half:
                result = get('games/'+quote(half['gameId']), season=year)
                observed = next(r for r in result['playerStatistics'] if r['playerId']==half['playerId'] and r['teamId']==half['teamId'])
                check(observed['stats']==half['stats'], 'Fractional defensive sacks and complete game player stats retained')
                fractional_tested = True
        if not tie_tested:
            tie = next((g for g in data['games'] if g['homeScore'] is not None and g['homeScore']==g['awayScore']), None)
            if tie:
                result = get('games/'+tie['gameId'], season=year)
                check(result['game']['homeScore']==result['game']['awayScore']==tie['homeScore'], 'Tied final score preserved')
                tie_tested = True
        if not january_tested:
            game = next((g for g in data['games'] if g['seasonType']=='POST' and int(g['date'][:4])==year+1), None)
            if game:
                result = get('games/'+game['gameId'], season=year)
                check(result['game']['season']==year and result['game']['seasonType']=='POST', 'January postseason keeps original NFL season')
                january_tested = True
        if not unplayed_tested:
            game = next((g for g in data['games'] if g['homeScore'] is None and g['awayScore'] is None), None)
            if game:
                result = get('games/'+game['gameId'], season=year)
                check(result['game']['homeScore'] is None and result['game']['awayScore'] is None and not result['teamStatistics'], 'Unplayed game stays null without invented team totals')
                unplayed_tested = True
        if not roster_only_tested:
            observed_ids = {r['playerId'] for r in data['player_stats']}
            p = next((p for p in data['players'] if p['playerId'] not in observed_ids), None)
            if p:
                result = get('players/'+quote(p['playerId']), season=year)
                check(not result['statistics'] and not result['games'], 'Roster-only player has no invented game appearance')
                roster_only_tested = True
        del data
    year = max(m['season'] for m in manifests)
    for path, query, code in [
        ('games',{'week':0},400),('games',{'week':31},400),('games',{'seasonType':'BAD'},400),
        ('games',{'status':'live'},400),('games',{'order':'BAD'},400),('games',{'page':0},400),
        ('players',{'pageSize':101},400),('statistics',{'kind':'BAD'},400),
        ('statistics',{'statGroup':'BAD'},400),('players/missing',{},404),
        ('games/missing',{},404),('teams/missing',{},404),('games',{'teamId':'missing'},404),
    ]:
        get(path, expected_status=code, season=year, **query)
    get('teams', expected_status=400, season=1800)
    unused = next(y for y in range(1999,2101) if y not in {m['season'] for m in manifests})
    get('teams', expected_status=404, season=unused)
    check(get('coverage')['season']==year, 'Default season is newest published year')
    print(f'All {count} NFL API checks passed.')


if __name__ == '__main__':
    main()
