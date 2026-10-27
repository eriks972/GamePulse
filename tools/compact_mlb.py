#!/usr/bin/env python3
"""One-time conversion of the active API snapshot to season ZIPs, without recollecting data."""
import argparse,shutil,sys
from pathlib import Path
from import_mlb import lock
from mlb_archive import snapshot,staging,reuse,activate

def compact(root,keep_previous=False):
 root=root.expanduser().resolve()
 with lock(root):
  old,years,report=snapshot(root)
  if old is None:raise ValueError('No active API snapshot to compact')
  if all((old/'seasons'/f'{y}.zip').exists() for y in years):print('All active seasons are already compressed.');return old
  original=sum(p.stat().st_size for p in old.rglob('*') if p.is_file())
  with staging(root) as stage:
   for y in years:reuse(old,stage,y);print(f'{y}: compressed/verified',flush=True)
   compressed=sum(p.stat().st_size for p in stage.rglob('*') if p.is_file())
   final=activate(root,stage,years,report.get('seasons',[]),old,keep_previous)
   print(f'Season payloads: {original/1024**2:.1f} MiB before; {compressed/1024**2:.1f} MiB compressed',flush=True)
   return final
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--destination',type=Path,required=True);p.add_argument('--keep-previous',action='store_true');a=p.parse_args()
 try:compact(a.destination,a.keep_previous)
 except Exception as e:print('Compaction failed; inspect current.json before retrying: '+str(e),file=sys.stderr);sys.exit(1)
