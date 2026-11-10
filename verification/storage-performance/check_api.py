#!/usr/bin/env python3
"""Compare unchanged JSON and compression using two APIs with identical imported data."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import gzip
import json
from urllib.request import Request, urlopen


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--baseline', required=True)
    p.add_argument('--api', required=True)
    p.add_argument('--season', type=int, default=2025)
    p.add_argument('--nba-season', type=int, default=2022)
    a = p.parse_args()
    assertions = 0
    def check(condition, message):
        nonlocal assertions
        if not condition:
            raise AssertionError(message)
        assertions += 1
    def fetch(api, path, encoding='identity', extra=None):
        headers = {'Accept-Encoding': encoding, 'Origin': 'https://game-pulse-steel.vercel.app'}
        headers.update(extra or {})
        with urlopen(Request(api.rstrip('/') + path, headers=headers), timeout=120) as r:
            received = dict(r.headers.items())
            received['Vary'] = ', '.join(r.headers.get_all('Vary', []))
            return r.status, received, r.read()
    def decode(response):
        _, h, b = response
        if h.get('Content-Encoding') == 'gzip':
            b = gzip.decompress(b)
        return json.loads(b)
    routes = []
    for league in ['nba', 'wnba', 'mlb', 'nfl', 'nhl']:
        year = a.nba_season if league == 'nba' else a.season
        for name in ['teams', 'players', 'games', 'standings']:
            routes.append(f'/api/leagues/{league}/{name}?season={year}')
    for league, names in [('nba', ['team-stats']), ('wnba', ['coverage', 'team-stats', 'player-stats']), ('mlb', ['coverage', 'analytics', 'batting', 'pitching']), ('nfl', ['coverage', 'statistics', 'leaderboards']), ('nhl', ['coverage', 'analytics', 'statistics'])]:
        for name in names:
            routes.append(f'/api/leagues/{league}/{name}?season={a.nba_season if league == "nba" else a.season}')
    for name in ['batting', 'pitching']:
        routes.extend([f'/api/leagues/mlb/{name}?season={a.season}&kind=team', f'/api/leagues/mlb/{name}?season={a.season}&page=2&pageSize=10'])
    routes.extend([f'/api/leagues/nfl/leaderboards?season={a.season}&group=rushing&seasonType=POST', f'/api/leagues/nhl/statistics?season={a.season}&group=goalie'])
    reductions = []
    for path in routes:
        base = fetch(a.baseline, path)
        current = fetch(a.api, path)
        check(base[0] == current[0] == 200, 'HTTP status: ' + path)
        check(decode(base) == decode(current), 'Unchanged JSON: ' + path)
        zipped = fetch(a.api, path, 'gzip')
        check(zipped[1].get('Content-Encoding') == 'gzip', 'gzip negotiated: ' + path)
        check(decode(zipped) == decode(current), 'gzip decoded body: ' + path)
        check('Accept-Encoding' in zipped[1].get('Vary', ''), 'Vary: ' + path)
        check(zipped[1].get('Access-Control-Allow-Origin') == 'https://game-pulse-steel.vercel.app', 'CORS preserved: ' + path)
        reductions.append((len(current[2]), len(zipped[2])))
        print('PASS', path, flush=True)
    endpoint = f'/api/leagues/mlb/batting?season={a.season}'
    expected = decode(fetch(a.api, endpoint))
    with ThreadPoolExecutor(max_workers=8) as pool:
        responses = list(pool.map(lambda _: decode(fetch(a.api, endpoint)), range(20)))
    check(all(x == expected for x in responses), 'Concurrent MLB responses preserve results')
    authorized = fetch(a.api, endpoint, 'gzip', {'Authorization': 'Bearer test-no-auth-route'})
    check('Content-Encoding' not in authorized[1], 'Authorization requests skip public compression branch')
    check(decode(authorized) == expected, 'Authorization header does not change JSON')
    no_encoding = fetch(a.api, endpoint, 'identity')
    check('Content-Encoding' not in no_encoding[1], 'identity honored')
    try:
        import brotli
    except ImportError:
        print('SKIP Brotli decode check: install brotli to enable it')
    else:
        compressed = fetch(a.api, endpoint, 'br')
        check(compressed[1].get('Content-Encoding') == 'br', 'Brotli negotiated')
        check(json.loads(brotli.decompress(compressed[2])) == expected, 'Brotli decoded body')
    before, after = map(sum, zip(*reductions))
    print(f'{assertions} API/compression assertions passed across {len(routes)} routes; sampled JSON {before:,} bytes identity, {after:,} bytes gzip ({100 * (1 - after / before):.1f}% smaller)')


if __name__ == '__main__':
    main()
