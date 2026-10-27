#!/usr/bin/env python3
"""Validate the active MLB import, then report/remove obsolete copies. Python 3.10+."""
import argparse,contextlib,fcntl,hashlib,json,os,re,shutil,subprocess,sys
from pathlib import Path
from mlb_archive import snapshot
import zipfile

RUN=re.compile(r'^runs/[A-Za-z0-9-]+$')
def read(p):
 if p.exists():return json.loads(p.read_text(encoding='utf-8'))
 folder=p.parent;entry=p.name
 if folder.name=='game_stats':entry='game_stats/'+entry;folder=folder.parent
 with zipfile.ZipFile(folder.with_suffix('.zip')) as z:return json.loads(z.read(entry))
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
 raw=(root/'current.json').read_bytes();run,years,_=snapshot(root)
 if run is None:raise ValueError('No active API snapshot')
 print('Active snapshot VERIFIED:',run.name,'; seasons',','.join(map(str,years)),flush=True)
 return raw,run,set(years)
def prepared(root):
 raw=(root/'current.json').read_bytes();pointer=json.loads(raw)
 if pointer.get('version')!=1 or not RUN.fullmatch(pointer.get('run','')):raise ValueError('Invalid collector ready pointer')
 run=root/pointer['run'];plain_tree(run);years=read(run/'seasons.json')
 if not isinstance(years,list) or not years or any(type(y)!=int for y in years) or sorted(pointer.get('seasons',[]))!=sorted(years):raise ValueError('Invalid prepared season index')
 checks=read(run/'checksums.json')
 names=['teams','players','games','rosters','team_game_stats','player_game_stats','line_scores','standings','coverage']
 required={'seasons.json','preparation_report.json'}|{f'seasons/{y}/{name}.json' for y in years for name in names}
 if not isinstance(checks,dict) or not required.issubset(checks):raise ValueError('Incomplete prepared checksum index')
 for relative,expected in checks.items():
  p=run/relative
  if Path(relative).is_absolute() or not p.resolve().is_relative_to(run.resolve()) or sha(p)!=expected:raise ValueError('Prepared checksum mismatch: '+relative)
 print('Prepared snapshot VERIFIED:',pointer['run'],'; seasons',','.join(map(str,years)),flush=True)
 return raw,run,set(years),checks

def prepared_candidates(root,keep,years,checks):
 # Retire a prepared run only if all its essential datasets are byte-identical
 # to those years in the verified current preparation. Different versions stay.
 names=['teams','players','games','rosters','team_game_stats','player_game_stats','line_scores','standings']
 result=[]
 for p in sorted((root/'runs').iterdir()):
  if p==keep or not p.is_dir():continue
  plain_tree(p)
  try:
   oldyears=read(p/'seasons.json')
   if not isinstance(oldyears,list) or not oldyears or any(type(y)!=int for y in oldyears) or not set(oldyears).issubset(years):raise ValueError('Different seasons')
   for y in oldyears:
    for name in names:
     rel=f'seasons/{y}/{name}.json'
     if checks.get(rel)!=sha(p/rel):raise ValueError('Different dataset')
  except (OSError,ValueError,KeyError,TypeError):print('KEEP prepared run with different/uncovered data:',p.name);continue
  result.append(p)
 return result

def incomplete(root,repo=None):
 result=[]
 for p in sorted(root.glob('building-*')):
  if not p.is_dir() or not re.fullmatch(r'building-\d{8}T\d{6}-[0-9a-f]{8}',p.name):continue
  plain_tree(p)
  if repo is not None and git(repo,'ls-files','--',p.relative_to(repo).as_posix()).strip():print('KEEP incomplete folder containing tracked files:',p.name);continue
  result.append(p)
 return result

def cleanup(repo,apply=False,collector_ready=None,remove_incomplete=False):
 repo=repo.expanduser().resolve();project=repo/'backend/GamePulse.Api';root=project/'Data/processed/mlb'
 if not (project/'GamePulse.Api.csproj').is_file() or Path(git(repo,'rev-parse','--show-toplevel').decode().strip()).resolve()!=repo:raise ValueError('Use the GamePulse Git repository root')
 if root.is_symlink() or (root/'runs').is_symlink():raise ValueError('MLB root/runs must not be symlinks')
 # Nonblocking locks used by both collector preparation and the API importer.
 with contextlib.ExitStack() as stack:
  ready=None
  if collector_ready is not None:
   raw_ready=collector_ready.expanduser().absolute()
   if raw_ready.resolve()!=raw_ready or raw_ready.name!='ready' or not (raw_ready.parent/'manifest.json').is_file():raise ValueError('Use the collector mlb_data/ready directory without symlinks')
   manifest=read(raw_ready.parent/'manifest.json')
   if manifest.get('league')!='mlb' or manifest.get('version')!=1:raise ValueError('Not an MLB collector data directory')
   ready=raw_ready
   if (ready/'runs').resolve()!=ready/'runs':raise ValueError('Collector runs directory must not contain symlinks')
   if ready.is_relative_to(repo) or repo.is_relative_to(ready.parent):raise ValueError('Collector data must be separate from the GamePulse repo')
  paths=[root/'.import.lock']+([ready.parent/'.collector.lock',ready/'.collector.lock'] if ready else [])
  for path in paths:
   lock=stack.enter_context(path.open('a'))
   try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
   except BlockingIOError:raise ValueError('An import/collector/preparation is running; stop it before cleanup') from None
  if root.resolve()!=root or project.resolve()!=project:raise ValueError('Repository data/project paths must not contain symlinks')
  before,keep,years=active(root)
  active_games={y:{g['id']:g for g in read(keep/f'seasons/{y}/games.json')} for y in years}
  candidates=[]
  pointers=[(root/'current.json',before)]
  if ready is not None:
   prepared_before,prepared_keep,prepared_years,checks=prepared(ready)
   pointers.append((ready/'current.json',prepared_before))
   candidates.extend(prepared_candidates(ready,prepared_keep,prepared_years,checks))
  if remove_incomplete:
   candidates.extend(incomplete(root,repo))
   if ready is not None:candidates.extend(incomplete(ready))
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
   n=size(p);total+=n;print(('REMOVE' if apply else 'WOULD REMOVE'),human(n),str(p),flush=True)
  print(('Reclaiming' if apply else 'Estimated reclaimable file bytes:'),human(total),flush=True)
  if apply:
   for p in candidates:
    if any(path.read_bytes()!=value for path,value in pointers):raise ValueError('Active/prepared pointer changed; stopped before further deletion')
    plain_tree(p);shutil.rmtree(p)
   print('Cleanup complete. Active API/prepared data, raw downloads and backups were preserved. Review Git deletions before committing.')
  else:print('Report only. Stop local servers/builds, then repeat with --apply to remove exactly these categories.')
  if not remove_incomplete:
   for directory in [root]+([ready] if ready else []):
    for p in sorted(directory.glob('building-*')):print('LEFT IN PLACE (add --remove-incomplete):',p.name)
  free=shutil.disk_usage(repo).free;print('Available disk space now:',human(free),flush=True)
  if ready is not None:
   estimate=size(prepared_keep)*1.5+512*1024**2
   print('Conservative planning target before retrying import:',human(estimate),'free (estimate, not a guarantee).',flush=True)
   if free<estimate:print('Still below that target. Do not retry yet; inspect remaining folder sizes or use another volume.')
  return total

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--repo',type=Path,default=Path.home()/'gamepulse');p.add_argument('--apply',action='store_true');p.add_argument('--collector-ready',type=Path);p.add_argument('--remove-incomplete',action='store_true',help='Remove abandoned building-* folders under locked data roots');a=p.parse_args()
 try:cleanup(a.repo,a.apply,a.collector_ready,a.remove_incomplete);return 0
 except Exception as e:print('Stopped: '+str(e),file=sys.stderr);return 1
if __name__=='__main__':sys.exit(main())
