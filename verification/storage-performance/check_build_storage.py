#!/usr/bin/env python3
"""Verify build/publish data behavior in a disposable project with synthetic snapshots."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--dotnet', default='dotnet')
    a = p.parse_args()
    repo = Path(__file__).resolve().parents[2]
    with tempfile.TemporaryDirectory(prefix='gamepulse-build-storage-') as tmp:
        project = Path(tmp) / 'api'
        shutil.copytree(repo / 'backend/GamePulse.Api', project, ignore=shutil.ignore_patterns('Data', 'bin', 'obj', 'publish'))
        data = project / 'Data/processed'
        run = '20261029T120000-1234abcd'
        def write(name, value):
            target = data / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(json.dumps(value).encode())
        write('teams.json', [{'name': 'NBA fixture'}])
        write('games_by_season/2025.json', [])
        write('wnba/seasons/2025/teams.json', [])
        write('mlb/current.json', dict(version=1, league='mlb', run='runs/' + run))
        write('mlb/runs/' + run + '/seasons.json', [2025])
        write('mlb/runs/' + run + '/seasons/2025.zip', {'fixture': 'archive-copy-test'})
        write('mlb/runs/retired/seasons.json', [2000])
        write('mlb/building-test/partial.json', {})
        for league, names in [('nfl', ['games', 'teams', 'players', 'rosters', 'records', 'team_stats', 'player_stats', 'unassigned_stats']), ('nhl', ['season'])]:
            write(league + '/seasons.json', [2025])
            write(league + '/seasons/2025/current.json', dict(runId=run))
            if league == 'nfl':
                write(league + '/seasons/2025/runs/' + run + '/manifest.json', dict(runId=run))
            for name in names:
                write(league + '/seasons/2025/runs/' + run + '/' + name + '.json.gz', [])
            write(league + '/seasons/2025/runs/20260101T000000-deadbeef/retired.json.gz', [])
        raw = project / 'Data/raw/raw.json'; raw.parent.mkdir(parents=True); raw.write_text('{}')
        script = project / 'Data/scripts/helper.json'; script.parent.mkdir(parents=True); script.write_text('{}')
        before = {str(p.relative_to(data)): hashlib.sha256(p.read_bytes()).hexdigest() for p in data.rglob('*') if p.is_file()}
        def command(*argv, success=True):
            result = subprocess.run([a.dotnet, *argv, '-p:NuGetAudit=false'], cwd=project, capture_output=True, text=True)
            if (result.returncode == 0) != success:
                raise AssertionError(result.stdout + result.stderr)
        command('build', '-c', 'Release')
        output = project / 'bin/Release/net10.0'
        assert not (output / 'Data/processed').exists(), 'Default build duplicated data'
        print('PASS default build has no processed-data copy')
        destination = Path(tmp) / 'deployment'
        command('publish', '-c', 'Release', '-o', str(destination))
        expected = [name for name in before if 'retired' not in name and 'building-' not in name and 'deadbeef' not in name]
        actual = [str(p.relative_to(destination / 'Data/processed')) for p in (destination / 'Data/processed').rglob('*') if p.is_file()]
        assert set(expected) == set(actual), (set(expected) - set(actual), set(actual) - set(expected))
        for name in expected:
            assert hashlib.sha256((destination / 'Data/processed' / name).read_bytes()).hexdigest() == before[name]
        assert not (destination / 'Data/raw').exists()
        assert not (destination / 'Data/scripts').exists()
        assert not (output / 'Data/processed').exists(), 'Publish duplicated data in intermediate bin'
        print('PASS publish copies active payloads for all five leagues byte-for-byte, excludes retired/incomplete runs and raw/scripts, and skips intermediate data copy')
        command('build', '-c', 'Release', '-p:GamePulseCopyDataToOutput=true')
        assert (output / 'Data/processed/teams.json').is_file()
        assert (output / ('Data/processed/mlb/runs/' + run + '/seasons/2025.zip')).is_file()
        print('PASS optional build data copies')
        assert before == {str(p.relative_to(data)): hashlib.sha256(p.read_bytes()).hexdigest() for p in data.rglob('*') if p.is_file()}
        print('PASS all source snapshots preserved')
        write('nfl/seasons/2025/current.json', dict(runId='../escape'))
        command('publish', '-c', 'Release', '-o', str(Path(tmp) / 'invalid'), success=False)
        print('PASS invalid active pointer still fails publishing')


if __name__ == '__main__':
    main()
