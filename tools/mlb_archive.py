"""Season ZIP storage, immutable snapshot reuse and atomic activation. No third-party packages."""
import contextlib,hashlib,json,os,re,shutil,uuid,zipfile
from datetime import datetime,timezone
from pathlib import Path

def read(path):return json.loads(path.read_text(encoding='utf-8'))
def sha(path):
 h=hashlib.sha256()
 with path.open('rb') as f:
  for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
 return h.hexdigest()
def write(path,value):
 path.parent.mkdir(parents=True,exist_ok=True);tmp=path.with_name(path.name+'.tmp')
 tmp.write_text(json.dumps(value,ensure_ascii=False,allow_nan=False,separators=(',',':'))+'\n');tmp.replace(path)
def snapshot(root):
 if not (root/'current.json').exists():return None,[],{}
 p=read(root/'current.json')
 if p.get('version')!=1 or p.get('league')!='mlb' or not re.fullmatch(r'runs/[A-Za-z0-9-]+',p.get('run','')):raise ValueError('Invalid active API pointer')
 run=root/p['run']
 if run.resolve()!=run:raise ValueError('Snapshot symlinks are not supported')
 years=read(run/'seasons.json');checks=read(run/'checksums.json')
 if not years or any(type(y)!=int or not 1876<=y<=9999 for y in years) or sorted(p.get('seasons',[]))!=sorted(years):raise ValueError('Invalid active season index')
 for rel,expected in checks.items():
  f=run/rel
  if not f.resolve().is_relative_to(run) or f.is_symlink() or not f.is_file() or sha(f)!=expected:raise ValueError('Active snapshot checksum mismatch: '+rel)
 for y in years:
  archive=run/'seasons'/f'{y}.zip'
  if archive.exists():
   if f'seasons/{y}.zip' not in checks:raise ValueError('Missing season archive checksum')
   with zipfile.ZipFile(archive) as z:
    names=z.namelist();name_set=set(names)
    if len(names)!=len(name_set) or any(n.startswith('/') or '..' in Path(n).parts for n in names):raise ValueError('Unsafe/duplicate ZIP entry')
    for name in ['teams.json','players.json','games.json','standings.json','coverage.json','batting.json','pitching.json']:
     if name not in name_set:raise ValueError('Incomplete season archive: '+name)
    games=json.loads(z.read('games.json'))
    if any(f"game_stats/{g['sourceId']}.json" not in name_set for g in games):raise ValueError('Season archive omits a game')
  else:
   for name in ['teams','players','games','standings','coverage','batting','pitching']:
    if f'seasons/{y}/{name}.json' not in checks:raise ValueError('Legacy snapshot omits required file: '+name)
   games=read(run/'seasons'/str(y)/'games.json')
   if any(f"seasons/{y}/game_stats/{g['sourceId']}.json" not in checks for g in games):raise ValueError('Legacy snapshot omits a game')
 return run,sorted(years),read(run/'import_report.json')
def stamp():return datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S')+'-'+uuid.uuid4().hex[:8]
def put(z,name,value):
 info=zipfile.ZipInfo(name,date_time=(1980,1,1,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED
 z.writestr(info,json.dumps(value,ensure_ascii=False,allow_nan=False,separators=(',',':'))+'\n')
def reuse(old,stage,year):
 target=stage/'seasons'/f'{year}.zip';target.parent.mkdir(parents=True,exist_ok=True);source=old/'seasons'/f'{year}.zip'
 if source.exists():
  try:os.link(source,target)
  except OSError:shutil.copyfile(source,target)
 else:
  folder=old/'seasons'/str(year)
  with zipfile.ZipFile(target,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
   for p in sorted(folder.rglob('*.json')):
    if p.is_symlink():raise ValueError('Legacy season contains symlinks')
    z.write(p,p.relative_to(folder).as_posix())
  with zipfile.ZipFile(target) as z:
   if z.testzip():raise ValueError('Archive CRC check failed')
 return target
@contextlib.contextmanager
def staging(root):
 active_run=read(root/'current.json').get('run') if (root/'current.json').exists() else None
 for orphan in (root/'runs').glob('*'):
  marker=orphan/'.history-stage'
  if orphan.relative_to(root).as_posix()!=active_run and not orphan.is_symlink() and marker.is_file() and marker.read_text()=='season-zip-v1':shutil.rmtree(orphan)
 for abandoned in root.glob('building-*'):
  marker=abandoned/'.history-stage'
  if not abandoned.is_symlink() and marker.is_file() and marker.read_text()=='season-zip-v1':shutil.rmtree(abandoned)
 p=root/('building-'+stamp());p.mkdir();(p/'.history-stage').write_text('season-zip-v1')
 try:yield p
 finally:
  if p.exists():shutil.rmtree(p)
def activate(root,stage,years,counts,old,keep_previous=False):
 write(stage/'seasons.json',sorted(years))
 write(stage/'import_report.json',dict(version=1,storageFormat='season-zip-v1',createdAt=datetime.now(timezone.utc).isoformat(),seasons=counts))
 write(stage/'checksums.json',{p.relative_to(stage).as_posix():sha(p) for p in sorted(stage.rglob('*')) if p.is_file() and p.name!='.history-stage'})
 # CRC validates new/reused archives without extracting them to disk.
 for p in (stage/'seasons').glob('*.zip'):
  with zipfile.ZipFile(p) as z:
   if z.testzip():raise ValueError('Archive CRC check failed: '+p.name)
 final=root/'runs'/stage.name.removeprefix('building-');final.parent.mkdir(exist_ok=True);stage.replace(final)
 try:write(root/'current.json',dict(version=1,league='mlb',run=final.relative_to(root).as_posix(),seasons=sorted(years)))
 except BaseException:
  committed=False
  try:committed=read(root/'current.json').get('run')==final.relative_to(root).as_posix()
  except (OSError,ValueError):pass
  if not committed:shutil.rmtree(final)
  raise
 try:(final/'.history-stage').unlink(missing_ok=True)
 except OSError:pass
 if old is not None and not keep_previous:
  try:shutil.rmtree(old)
  except OSError as e:print('New snapshot is active; could not retire previous run:',e,flush=True)
 print('Active snapshot:',final,flush=True)
 return final
