#!/usr/bin/env python3
"""Report GamePulse storage; optionally remove ignored local build data copies only."""
import argparse
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys


def git(repo, *args):
    return subprocess.run(['git', '-C', str(repo), *args], check=True, capture_output=True).stdout


def files(path):
    if not path.exists() or path.is_symlink():
        return
    for folder, dirs, names in os.walk(path, followlinks=False):
        dirs[:] = [name for name in dirs if not (Path(folder) / name).is_symlink()]
        for name in names:
            p = Path(folder) / name
            if not p.is_symlink():
                yield p


def usage(path):
    # Hard-linked unchanged MLB archives occupy disk once even across runs.
    seen = set()
    logical = allocated = count = 0
    for p in files(path):
        stat = p.stat()
        identity = (stat.st_dev, stat.st_ino)
        logical += stat.st_size
        count += 1
        if identity not in seen:
            allocated += getattr(stat, 'st_blocks', (stat.st_size + 511) // 512) * 512
            seen.add(identity)
    return dict(files=count, logicalBytes=logical, allocatedBytes=allocated)


def candidates(repo):
    project = repo / 'backend/GamePulse.Api'
    base = project / 'bin'
    result = []
    if not base.exists():
        return result
    if base.is_symlink():
        raise ValueError('Refusing a symlinked bin directory.')
    for config in sorted(base.iterdir()):
        if config.is_symlink() or not config.is_dir():
            continue
        for framework in sorted(config.iterdir()):
            if framework.is_symlink() or not framework.is_dir() or not re.fullmatch(r'net\d+\.\d+(?:-[A-Za-z0-9.-]+)?', framework.name):
                continue
            p = framework / 'Data/processed'
            if not p.exists():
                continue
            if p.resolve() != p or p.is_symlink():
                raise ValueError('Refusing symlinked build data: ' + str(p))
            if any(item.is_symlink() for item in p.rglob('*')):
                raise ValueError('Refusing build data containing symlinks: ' + str(p))
            relative = p.relative_to(repo).as_posix()
            if git(repo, 'ls-files', '-z', '--', relative):
                raise ValueError('Build data contains tracked files; left untouched: ' + relative)
            ignored = subprocess.run(['git', '-C', str(repo), 'check-ignore', '-q', '--', relative])
            if ignored.returncode != 0:
                raise ValueError('Build data is not Git-ignored; left untouched: ' + relative)
            result.append(p)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo', type=Path, default=Path.home() / 'gamepulse')
    parser.add_argument('--apply', action='store_true', help='Stop local builds/servers first. Remove only ignored bin/<configuration>/<framework>/Data/processed copies.')
    parser.add_argument('--json', action='store_true', help='Machine-readable report')
    args = parser.parse_args()
    try:
        repo = args.repo.expanduser().resolve()
        if Path(git(repo, 'rev-parse', '--show-toplevel').decode().strip()).resolve() != repo or not (repo / 'backend/GamePulse.Api/GamePulse.Api.csproj').is_file():
            raise ValueError('Use the GamePulse Git repository root.')
        if (repo / 'backend/GamePulse.Api').resolve() != repo / 'backend/GamePulse.Api':
            raise ValueError('Project directory must not be a symlink.')
        selected = candidates(repo)
        labels = ['backend/GamePulse.Api/Data/processed', 'backend/GamePulse.Api/Data/raw', 'backend/GamePulse.Api/bin', 'backend/GamePulse.Api/obj', 'backend/GamePulse.Api/publish', 'frontend/gamepulse-web/.next', 'frontend/gamepulse-web/node_modules', '.git']
        report = dict(freeBytes=shutil.disk_usage(repo).free, categories={name: usage(repo / name) for name in labels}, removableBuildCopies={p.relative_to(repo).as_posix(): usage(p) for p in selected})
        if args.apply:
            # Validate the whole deletion set first; never follows a data pointer.
            if candidates(repo) != selected:
                raise ValueError('Build directories changed; stopped before cleanup.')
            for p in selected:
                shutil.rmtree(p)
            report['freeBytesAfter'] = shutil.disk_usage(repo).free
        if args.json:
            print(json.dumps(report, indent=2))
        else:
            gib = lambda n: f'{n / 1024**3:.2f} GiB'
            print('Available disk space:', gib(report['freeBytes']))
            print('Category sizes (hard links counted once within each category):')
            for name, value in report['categories'].items():
                print(f"  {gib(value['allocatedBytes']):>10} allocated; {gib(value['logicalBytes']):>10} file bytes  {name}")
            for name, value in report['removableBuildCopies'].items():
                print(('REMOVED ' if args.apply else 'WOULD REMOVE ') + name + ' (' + gib(value['allocatedBytes']) + ' allocated)')
            if args.apply:
                print('Cleanup complete. Source data, collectors, Git history, and published folders preserved.')
                print('Available disk space now:', gib(report['freeBytesAfter']))
            else:
                print('Report only. Stop local builds/servers, then add --apply to remove the listed build copies.')
            print('Volumes may share blocks through APFS clones; allocated sizes are estimates, not guaranteed reclaimed space.')
        return 0
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        print('Stopped: ' + str(error), file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
