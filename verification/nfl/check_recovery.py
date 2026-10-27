#!/usr/bin/env python3
"""Exercise NFL missing/corrupt data and run refresh using isolated synthetic snapshots."""
import argparse
import gzip
import hashlib
import json
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.request import urlopen


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--dotnet', default='dotnet')
    p.add_argument('--app', type=Path, required=True, help='Published GamePulse.Api.dll')
    args = p.parse_args()
    total = 0

    def check(ok, name):
        nonlocal total
        assert ok, name
        total += 1
        print(f'PASS {total}: {name}', flush=True)

    with tempfile.TemporaryDirectory(prefix='gamepulse-nfl-check-') as tmp:
        host = Path(tmp)
        base = host / 'Data/processed/nfl'
        pointer = base / 'seasons/2025/current.json'
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            port = sock.getsockname()[1]

        def get(path, status=200):
            try:
                with urlopen(f'http://127.0.0.1:{port}/api/leagues/nfl/'+path, timeout=30) as r:
                    code, body = r.status, r.read()
            except HTTPError as e:
                code, body = e.code, e.read()
            check(code == status, path + ': HTTP ' + str(status))
            return json.loads(body)

        def run(run_id, name):
            game = dict(gameId='2025_01_A_B', season=2025, seasonType='REG', round='REG', week=1,
                        date='2025-09-04', kickoffUtc=None, homeTeamId='B', awayTeamId='A',
                        homeScore=3, awayScore=0, status='final', stadium=None)
            team = dict(teamId='A', sourceTeamId='A', name=name, conference='AFC', division='AFC Test', color=None, logoUrl=None)
            player = dict(playerId='00-1234567', name='Test Player', position='QB', teamIds=['A'])
            stat = dict(season=2025, seasonType='REG', week=1, gameId=game['gameId'], teamId='A', opponentTeamId='B',
                        playerId=player['playerId'], name=player['name'], position='QB',
                        stats=dict(passing_yards=0, passing_epa=None, def_sacks=0.5))
            rows = dict(games=[game], teams=[team], players=[player], rosters=[], records=[],
                        player_stats=[stat], team_stats=[stat], unassigned_stats=[])
            manifest = dict(schemaVersion=1, league='NFL', season=2025, runId=run_id,
                            generatedAtUtc='2026-10-26T20:00:00+00:00', files={}, coverage={'games': 1})
            for key, data in rows.items():
                relative = f'seasons/2025/runs/{run_id}/{key}.json.gz'
                path = base / relative
                path.parent.mkdir(parents=True, exist_ok=True)
                content = gzip.compress(json.dumps(dict(schemaVersion=1, league='NFL', season=2025,
                                                        count=len(data), data=data)).encode())
                path.write_bytes(content)
                manifest['files'][key] = dict(path=relative, encoding='gzip', count=len(data), bytes=len(content), sha256=hashlib.sha256(content).hexdigest())
            pointer.write_text(json.dumps(manifest))
            return manifest

        def write(m):
            pointer.write_text(json.dumps(m))

        log = (host / 'server.log').open('w')
        api = subprocess.Popen([args.dotnet, str(args.app.resolve()), '--urls', f'http://127.0.0.1:{port}', '--contentRoot', str(host)],
                               stdout=log, stderr=log, env={**os.environ, 'Logging__LogLevel__Default': 'Warning'})
        try:
            for _ in range(100):
                try:
                    urlopen(f'http://127.0.0.1:{port}/api/leagues/nfl/seasons', timeout=1).close()
                    break
                except (URLError, TimeoutError):
                    time.sleep(.1)
            check(get('seasons') == [], 'No import produces empty season directory')
            get('teams', 404)
            first = run('20261026T200000-11111111', 'First run')
            (base / 'seasons.json').write_text('{"data":[]}')
            check(get('seasons')[0]['season'] == 2025, 'Current pointers recover stale global index')
            check(get('teams?season=2025')[0]['name'] == 'First run', 'Initial run is read')
            second = run('20261026T200001-22222222', 'Second run')
            check(get('teams?season=2025')[0]['name'] == 'Second run', 'Changed current pointer invalidates cached run')
            details = get('players/00-1234567?season=2025')
            check(details['statistics'][0]['stats'] == dict(passing_yards=0, passing_epa=None, def_sacks=.5), 'Null, zero, fractional values round-trip')
            broken = json.loads(json.dumps(second)); broken['files']['teams']['path'] = '../outside.json.gz'; write(broken)
            get('teams?season=2025', 503)
            pointer.write_text('{broken')
            get('seasons', 503)
            write(second)
            missing = base / second['files']['player_stats']['path']
            saved = missing.read_bytes(); missing.unlink()
            get('coverage?season=2025', 503)
            missing.write_bytes(saved)
            third = run('20261026T200002-33333333', 'Third run')
            target = base / third['files']['teams']['path']; saved = target.read_bytes()
            target.write_bytes(saved[:-1] + bytes([saved[-1] ^ 1]))
            result = get('teams?season=2025', 503)
            check(str(host) not in result['message'], 'Error response does not disclose filesystem path')
            target.write_bytes(saved)
            check(get('teams?season=2025')[0]['name'] == 'Third run', 'Failed dataset load can recover without restart')
            fourth = run('20261026T200003-44444444', 'Fourth run')
            target = base / fourth['files']['teams']['path']; saved = target.read_bytes()
            invalid = b'not gzip'; target.write_bytes(invalid)
            fourth['files']['teams'].update(bytes=len(invalid), sha256=hashlib.sha256(invalid).hexdigest()); write(fourth)
            get('teams?season=2025', 503)
            wrong = run('20261026T200004-55555555', 'Wrong envelope')
            target = base / wrong['files']['teams']['path']
            env = json.loads(gzip.decompress(target.read_bytes())); env['season'] = 2024
            invalid = gzip.compress(json.dumps(env).encode()); target.write_bytes(invalid)
            wrong['files']['teams'].update(bytes=len(invalid), sha256=hashlib.sha256(invalid).hexdigest()); write(wrong)
            get('teams?season=2025', 503)
        finally:
            api.terminate(); api.wait(timeout=10); log.close()
        print(f'All {total} NFL recovery checks passed.')


if __name__ == '__main__':
    main()
