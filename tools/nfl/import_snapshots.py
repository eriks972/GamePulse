#!/usr/bin/env python3
"""Merge compressed NFL season snapshots; skip existing years by default."""
import argparse
import fcntl
import gzip
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import tempfile

KEYS = {'games', 'teams', 'players', 'rosters', 'player_stats', 'team_stats', 'unassigned_stats', 'records'}


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp = tempfile.mkstemp(prefix='.writing-', dir=path.parent)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as handle:
            json.dump(value, handle, ensure_ascii=False, allow_nan=False, separators=(',', ':'))
        os.replace(temp, path)
    finally:
        Path(temp).unlink(missing_ok=True)


def sha(path):
    digest = hashlib.sha256()
    with path.open('rb') as handle:
        for chunk in iter(lambda: handle.read(1024*1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def snapshot(root, year, verify=True):
    pointer = root/'seasons'/str(year)/'current.json'
    manifest = json.loads(pointer.read_text())
    if manifest.get('schemaVersion') != 1 or manifest.get('league') != 'NFL' or manifest.get('season') != year or not re.fullmatch(r'\d{8}T\d{6}-[a-f0-9]{8}', manifest.get('runId', '')):
        raise ValueError(f'Invalid NFL pointer for {year}')
    if set(manifest.get('files', {})) != KEYS or not isinstance(manifest.get('coverage'), dict):
        raise ValueError(f'Incomplete NFL manifest for {year}')
    for key, item in manifest['files'].items():
        expected = f'seasons/{year}/runs/{manifest["runId"]}/{key}.json.gz'
        path = root/expected
        if item.get('path') != expected or item.get('encoding') != 'gzip' or not path.resolve().is_relative_to(root.resolve()) or not path.is_file():
            raise ValueError(f'Invalid NFL dataset path: {year} {key}')
        if type(item.get('count')) is not int or item['count'] < 0 or type(item.get('bytes')) is not int or path.stat().st_size != item['bytes']:
            raise ValueError(f'Invalid NFL file metadata: {year} {key}')
        if verify:
            if sha(path) != item.get('sha256'):
                raise ValueError(f'NFL checksum mismatch: {year} {key}')
            # CRC/integrity check with bounded memory, without expanding to disk.
            with gzip.open(path, 'rb') as handle:
                size = 0
                for chunk in iter(lambda: handle.read(1024*1024), b''):
                    size += len(chunk)
                    if size > 256*1024*1024:
                        raise ValueError(f'NFL expanded dataset exceeds import limit: {year} {key}')
    return manifest


def years(root):
    return sorted(int(p.parent.name) for p in (root/'seasons').glob('*/current.json') if re.fullmatch(r'\d{4}', p.parent.name))


def merge(source, destination):
    source, destination = source.expanduser().resolve(), destination.expanduser().resolve()
    if source.is_relative_to(destination) or destination.is_relative_to(source):
        raise ValueError('Keep source snapshots separate from the API destination')
    requested = years(source)
    if not requested:
        raise ValueError('No NFL current snapshots found at source')
    destination.mkdir(parents=True, exist_ok=True)
    with (destination/'.snapshot-import.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise ValueError('Another NFL snapshot import is running') from None
        # Verify every incoming dataset before activating the first new year.
        incoming = {year: snapshot(source, year) for year in requested}
        existing = {year: snapshot(destination, year, verify=False) for year in years(destination)}
        installed = []
        for year, manifest in incoming.items():
            if year in existing:
                print(f'{year}: already published; retained', flush=True)
                continue
            parent = destination/'seasons'/str(year)
            runs = parent/'runs'; runs.mkdir(parents=True, exist_ok=True)
            final = runs/manifest['runId']
            temp = Path(tempfile.mkdtemp(prefix='.importing-', dir=runs))
            try:
                for item in manifest['files'].values():
                    target = temp/Path(item['path']).name
                    shutil.copyfile(source/item['path'], target)
                    if sha(target) != item['sha256']:
                        raise ValueError('Copied NFL data checksum mismatch')
                write(temp/'manifest.json', manifest)
                if final.exists():
                    # A prior interrupted import may have completed its immutable run.
                    for item in manifest['files'].values():
                        if sha(final/Path(item['path']).name) != item['sha256']:
                            raise ValueError('Existing unpublished NFL run differs from source')
                else:
                    os.replace(temp, final)
                write(parent/'current.json', manifest)
            finally:
                shutil.rmtree(temp, ignore_errors=True)
            installed.append(year)
            print(f'{year}: published compressed snapshot', flush=True)
        all_manifests = [snapshot(destination, y, verify=False) for y in years(destination)]
        write(destination/'seasons.json', {'schemaVersion': 1, 'league': 'NFL', 'data': [
            {'season': m['season'], 'generatedAtUtc': m['generatedAtUtc'], 'manifestPath': f'seasons/{m["season"]}/current.json', 'coverage': m['coverage']} for m in all_manifests]})
        return installed


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True, help='Collector processed/ directory')
    parser.add_argument('--destination', type=Path, required=True)
    args = parser.parse_args()
    try:
        installed = merge(args.source, args.destination)
        print(f'Imported {len(installed)} new NFL seasons. Existing seasons retained.')
    except (ValueError, OSError, KeyError, TypeError) as error:
        parser.exit(1, 'NFL snapshot import stopped: '+str(error)+'\n')


if __name__ == '__main__':
    main()
