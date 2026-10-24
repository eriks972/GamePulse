#!/usr/bin/env python3
"""Validate the active MLB import, then report/remove obsolete copies. Python 3.10+."""
import argparse,contextlib,fcntl,hashlib,json,os,re,shutil,subprocess,sys
from pathlib import Path

RUN=re.compile(r'^runs/[A-Za-z0-9-]+$')
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
 return h.hexdigest()
def size(p):return sum(f.stat().st_size for f in p.rglob('*') if f.is_file() and not f.is_symlink())
def human(n):return f'{n/1024**3:.2f} GiB'
def plain_tree(p):
 if p.is_symlink() or any(f.is_symlink() for f in p.rglob('*')):raise ValueError(f'Refusing a directory containing symlinks: {p}')
def git(repo,*args):
 return subprocess.check_output(['git','-C',str(repo),*args])
def active(root):
 raw=(root/'current.json').read_bytes();pointer=json.loads(raw)
 if pointer.get('version')!=1 or pointer.get('league')!='mlb' or not RUN.fullmatch(pointer.get('run','')):raise ValueError('Invalid active pointer')
 run=root/pointer['run'];plain_tree(run)
 years=read(run/'seasons.json')
 if not isinstance(years,list) or not years or any(type(y)!=int or not 1876<=y<=9999 for y in years):raise ValueError('Invalid active season index')
 if sorted(pointer.get('seasons',[]))!=sorted(years):raise ValueError('Pointer seasons and active season index disagree')
 checks=read(run/'checksums.json')
 if not isinstance(checks,dict) or not checks:raise ValueError('Missing active checksum index')
 required={'seasons.json','import_report.json'}
 for y in years:
  required.update(f'seasons/{y}/{name}.json' for name in ['teams','players','games','standings','coverage'])
 if not required.issubset(checks):raise ValueError('Active checksum index omits required core files')
 for i,(relative,expected) in enumerate(checks.items(),1):
  p=run/relative
  if Path(relative).is_absolute() or not p.resolve().is_relative_to(run.resolve()) or not re.fullmatch('[0-9a-f]{64}',expected) or sha(p)!=expected:raise ValueError(f'Invalid active checksum/file: {relative}')
  if i%1000==0:print(f'Validated {i:,}/{len(checks):,} active files...',flush=True)
 for y in years:
  for game in read(run/f'seasons/{y}/games.json'):
   rel=f"seasons/{y}/game_stats/{game['sourceId']}.json"
   if rel not in checks:raise ValueError('Active checksum index omits a game partition: '+rel)
 print(f'Active snapshot VERIFIED: {pointer["run"]}; seasons {", ".join(map(str,years))}; {len(checks):,} files',flush=True)
 return raw,run,set(years)
def cleanup(repo,apply=False):
 repo=repo.expanduser().resolve();project=repo/'backend/GamePulse.Api';root=project/'Data/processed/mlb'
 if not (project/'GamePulse.Api.csproj').is_file() or Path(git(repo,'rev-parse','--show-toplevel').decode().strip()).resolve()!=repo:raise ValueError('Use the GamePulse Git repository root')
 if root.is_symlink() or (root/'runs').is_symlink():raise ValueError('MLB root/runs must not be symlinks')
 # Same lock as the importer; never clean while an import is running.
 with (root/'.import.lock').open('a') as lock:
  try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  except BlockingIOError:raise ValueError('An MLB import is running; finish it first') from None
  if root.resolve()!=root or project.resolve()!=project:raise ValueError('Repository data/project paths must not contain symlinks')
  before,keep,years=active(root)
  active_games={y:{g['id']:g for g in read(keep/f'seasons/{y}/games.json')} for y in years}
  candidates=[]
  for p in sorted((root/'runs').iterdir()):
   if p==keep or not p.is_dir():continue
   if not RUN.fullmatch('runs/'+p.name):print('KEEP unexpected directory:',p.name);continue
   plain_tree(p)
   try:old=read(p/'seasons.json')
   except (OSError,ValueError):print('KEEP incomplete/unrecognized run:',p.name);continue
   if not isinstance(old,list) or not old or any(type(y)!=int for y in old) or not set(old).issubset(years):
    print('KEEP run with seasons not covered by the active snapshot:',p.name);continue
   covered=True
   try:
    for y in old:
     for g in read(p/f'seasons/{y}/games.json'):
      newer=active_games[y].get(g['id'])
      if newer is None or g.get('completed') and not newer.get('completed') or any(g.get('coverage',{}).get(k,0)>newer.get('coverage',{}).get(k,0) for k in ['teamGroupRows','playerGroupRows','inningRows']):covered=False;break
   except (OSError,ValueError,KeyError,TypeError):covered=False
   if not covered:print('KEEP run with game coverage not covered by active snapshot:',p.name);continue
   relative=p.relative_to(repo).as_posix()
   if git(repo,'diff','--name-only','HEAD','--',relative).strip():print('KEEP run with local tracked changes:',p.name);continue
   candidates.append(p)
  for p in [project/'bin',project/'obj',project/'publish']:
   if not p.exists():continue
   plain_tree(p)
   if git(repo,'ls-files','--',p.relative_to(repo).as_posix()).strip():print('KEEP generated directory containing tracked files:',p.name);continue
   candidates.append(p)
  total=0
  for p in candidates:
   n=size(p);total+=n;print(('REMOVE' if apply else 'WOULD REMOVE'),human(n),p.relative_to(repo),flush=True)
  print(('Reclaiming' if apply else 'Estimated reclaimable file bytes:'),human(total),flush=True)
  if apply:
   for p in candidates:
    if (root/'current.json').read_bytes()!=before:raise ValueError('Active pointer changed; stopped before further deletion')
    plain_tree(p);shutil.rmtree(p)
   print('Cleanup complete. Active data and collector files were preserved. Review Git deletions before committing.')
  else:print('Report only. Stop local servers/builds, then repeat with --apply to remove exactly these categories.')
  for p in sorted(root.glob('building-*')):print('LEFT IN PLACE (incomplete import; not auto-deleted):',p.name)
  return total

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--repo',type=Path,default=Path.home()/'gamepulse');p.add_argument('--apply',action='store_true');a=p.parse_args()
 try:cleanup(a.repo,a.apply);return 0
 except Exception as e:print('Stopped: '+str(e),file=sys.stderr);return 1
if __name__=='__main__':sys.exit(main())
