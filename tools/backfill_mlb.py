#!/usr/bin/env python3
"""Resumable MLB history: one season collected, prepared and merged at a time."""
import argparse,fcntl,gzip,json,shutil,subprocess,sys,tempfile,zipfile,re,math,csv,io
from datetime import datetime
from pathlib import Path
from import_mlb import import_run
from mlb_archive import read,write

def years_at(destination):
 p=destination/'current.json'
 return set(read(p).get('seasons',[])) if p.exists() else set()
def checkpoint(path,state):
 write(path,state)
 buffer=io.StringIO();fields=['season','status','scheduleGames','completedGames','missingBoxscoreGames','missingLinescoreGames','report','error']
 writer=csv.DictWriter(buffer,fieldnames=fields,extrasaction='ignore');writer.writeheader()
 for year,value in sorted(state['seasons'].items(),key=lambda item:int(item[0])):writer.writerow(dict(value,season=year))
 tmp=path.parent/'history_coverage.csv.tmp';tmp.write_text(buffer.getvalue(),encoding='utf-8');tmp.replace(path.parent/'history_coverage.csv')

def run(args):
 collector=args.collector.expanduser().resolve();destination=args.destination.expanduser().resolve();data=collector/'mlb_data';work=data/'backfill';work.mkdir(parents=True,exist_ok=True)
 for name in ['collector.py','prepare_mlb.py','common.py']:
  if not (collector/name).is_file():raise ValueError('Collector file missing: '+name)
 if destination.is_relative_to(data) or data.is_relative_to(destination):raise ValueError('Keep API destination separate from collector data')
 with (work/'.backfill.lock').open('a') as handle:
  try:fcntl.flock(handle,fcntl.LOCK_EX|fcntl.LOCK_NB)
  except BlockingIOError:raise ValueError('A history backfill is already running') from None
  for abandoned in work.glob('year-*'):
   marker=abandoned/'.backfill-owned'
   if not abandoned.is_symlink() and marker.is_file() and marker.read_text()=='gamepulse-backfill-v1':shutil.rmtree(abandoned)
  destination.mkdir(parents=True,exist_ok=True)
  statepath=work/'state.json';state=read(statepath) if statepath.exists() else dict(version=1,seasons={})
  requested=list(range(args.end,args.start-1,-1))
  for y in requested:
   previous=state['seasons'].get(str(y),{})
   if y in years_at(destination) and (previous.get('status') not in ['partial','failed','no_schedule','request_failed'] or not args.retry_failed):
    status=previous.get('status','preexisting')
    if status in ('collecting','preparing','interrupted'):
     current=destination/read(destination/'current.json')['run'];archive=current/'seasons'/f'{y}.zip'
     if archive.exists():
      with zipfile.ZipFile(archive) as z:coverage=json.loads(z.read('coverage.json'))
     else:coverage=read(current/f'seasons/{y}/coverage.json')
     status='complete' if coverage.get('fileCoverageComplete') and previous.get('collectorCode',0)==0 else 'partial'
    state['seasons'][str(y)]={**previous,'status':status,'note':previous.get('note','Already imported; retained')};checkpoint(statepath,state);print(f'{y}: already imported; skipped',flush=True);continue
   if previous.get('status') in ['failed','no_schedule','request_failed'] and not args.retry_failed:
    print(f'{y}: prior unresolved year; use --retry-failed to retry',flush=True);continue
   if shutil.disk_usage(destination if destination.exists() else destination.parent).free<args.min_free_gib*1024**3:
    print('Stopped before next year: free space below configured minimum. Existing imported years are intact.',flush=True);return 3
   state['seasons'][str(y)]=dict(status='collecting');checkpoint(statepath,state)
   command=[sys.executable,str(collector/'collector.py'),'collect','--start',str(y),'--end',str(y),'--workers',str(args.workers),'--datasets','core']
   if getattr(args,'offline',False):command.append('--offline')
   collected=subprocess.run(command,cwd=collector)
   if collected.returncode not in (0,2):
    state['seasons'][str(y)]=dict(status='request_failed',exitCode=collected.returncode);checkpoint(statepath,state);continue
   state['seasons'][str(y)].update(status='preparing',collectorCode=collected.returncode);checkpoint(statepath,state)
   # This private temporary output contains only one year and is removed on
   # success, failure or Ctrl+C. Existing collector ready/current.json is untouched.
   try:
    with tempfile.TemporaryDirectory(prefix=f'year-{y}-',dir=work) as temp:
     (Path(temp)/'.backfill-owned').write_text('gamepulse-backfill-v1')
     ready=Path(temp)/'ready'
     prepared=subprocess.run([sys.executable,str(collector/'prepare_mlb.py'),'--input',str(data),'--output',str(ready),'--start',str(y),'--end',str(y)],cwd=collector)
     if prepared.returncode not in (0,2) or not (ready/'current.json').exists():
      entries=read(data/'manifest.json').get('records',{}).values()
      empty=any(r.get('season')==y and r.get('dataset')=='schedule' and r.get('status')=='empty' for r in entries)
      state['seasons'][str(y)]=dict(status='no_schedule' if empty else 'failed',note='No verified preparation; inspect collector reports');checkpoint(statepath,state);continue
     source=ready/read(ready/'current.json')['run'];coverage=read(source/f'seasons/{y}/coverage.json')
     report=dict(coverage=coverage,preparation=read(source/'preparation_report.json'),review=read(source/f'seasons/{y}/review.json'))
     path=work/'reports'/f'{y}.json.gz';path.parent.mkdir(exist_ok=True);tmp=path.with_suffix('.tmp')
     with gzip.open(tmp,'wt',encoding='utf-8') as f:json.dump(report,f,separators=(',',':'))
     tmp.replace(path)
     import_run(ready,destination,[y])
     status='complete' if coverage.get('fileCoverageComplete') and collected.returncode==0 else 'partial'
     state['seasons'][str(y)]=dict(status=status,scheduleGames=coverage.get('scheduleGames'),completedGames=coverage.get('completedGames'),missingBoxscoreGames=coverage.get('missingBoxscoreGames'),missingLinescoreGames=coverage.get('missingLinescoreGames'),issueCounts=coverage.get('issueCounts'),report=str(path));checkpoint(statepath,state)
     print(f'{y}: imported ({status}); temporary preparation removed after this year',flush=True)
   except KeyboardInterrupt:
    state['seasons'][str(y)]=dict(status='interrupted',collectorCode=collected.returncode);checkpoint(statepath,state);raise
   except Exception as e:
    state['seasons'][str(y)]=dict(status='failed',error=str(e));checkpoint(statepath,state)
    print('Stopped on import/preparation failure:',e,flush=True);return 3
  unresolved={str(y):state['seasons'].get(str(y),{}) for y in requested if state['seasons'].get(str(y),{}).get('status') not in ('complete','preexisting')}
  print(f'Requested {len(requested)} years; imported/retained {len(requested)-len(unresolved)}; unresolved or partial {len(unresolved)}.',flush=True)
  print('Checkpoint:',statepath,'\nCoverage:',work/'history_coverage.csv','\nYear reports:',work/'reports',flush=True)
  if unresolved:print('Unresolved years:',', '.join(unresolved),'(no missing data was invented)',flush=True)
  return 2 if unresolved else 0

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--collector',type=Path,required=True);p.add_argument('--destination',type=Path,required=True);p.add_argument('--start',type=int,default=1876);p.add_argument('--end',type=int,default=datetime.now().year);p.add_argument('--workers',type=int,default=4);p.add_argument('--min-free-gib',type=float,default=1.0);p.add_argument('--retry-failed',action='store_true');p.add_argument('--offline',action='store_true',help='Use only already downloaded raw files');a=p.parse_args()
 if a.start<1876 or a.end<a.start or a.end>datetime.now().year or not 1<=a.workers<=8 or not math.isfinite(a.min_free_gib) or a.min_free_gib<0:p.error('Invalid year range, workers or disk floor')
 try:return run(a)
 except KeyboardInterrupt:print('Stopped. Rerun the same command to resume; imported years remain intact.',file=sys.stderr);return 130
 except Exception as e:print('Backfill stopped: '+str(e),file=sys.stderr);return 1
if __name__=='__main__':sys.exit(main())
