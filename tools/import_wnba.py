#!/usr/bin/env python3
"""Import selected prepared WNBA seasons into an existing GamePulse.Api folder."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import shutil
import sys
import tempfile

FILES = ['games.json','teams.json','players.json','team_game_stats.json','player_game_stats.json','coverage.json']

def safe_child(parent, child):
    target=(parent/child).resolve()
    if not target.is_relative_to(parent.resolve()):
        raise ValueError('Referenced path escapes its parent directory')
    return target

def read(path):
    with path.open(encoding='utf-8') as f:return json.load(f)

def atomic_json(path,value):
    temp=path.with_suffix(path.suffix+'.tmp')
    temp.write_text(json.dumps(value,indent=2,allow_nan=False),encoding='utf-8');temp.replace(path)

def run(ready,backend,years):
    ready=ready.expanduser().resolve();backend=backend.expanduser().resolve()
    if ready.is_relative_to(backend):raise ValueError('--ready must be outside the backend directory so backups are not published')
    if not (backend/'GamePulse.Api.csproj').is_file():raise ValueError('--backend must contain GamePulse.Api.csproj')
    pointer=read(ready/'current.json');generation=safe_child(ready,pointer['run'])
    if not set(years).issubset(set(pointer['seasons'])):raise ValueError('A requested season is absent from current.json')
    # Validate every requested source file before touching the backend.
    sources={}
    for year in years:
        folder=safe_child(generation,Path('seasons')/str(year));sources[year]=folder
        for name in FILES:
            data=read(folder/name)
            if name=='coverage.json':
                if not isinstance(data,dict) or data.get('season')!=year:raise ValueError(f'{year}: mismatched coverage report')
            else:
                if not isinstance(data,list):raise ValueError(f'{year}/{name}: expected a JSON array')
                if name in ['games.json','teams.json'] and not data:raise ValueError(f'{year}/{name}: cannot be empty')
                if any(not isinstance(r,dict) or r.get('season')!=year for r in data):raise ValueError(f'{year}/{name}: wrong season or record shape')
    destination=backend/'Data/processed/wnba';destination.mkdir(parents=True,exist_ok=True)
    season_root=destination/'seasons';season_root.mkdir(exist_ok=True)
    index=destination/'seasons.json';existing=read(index) if index.exists() else []
    if not isinstance(existing,list) or any(type(y) is not int for y in existing):raise ValueError('Existing backend season index is invalid')
    stamp=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%f')
    # Backups stay alongside the collector, outside the backend publish context.
    backup=ready/'backend_import_backups'/stamp;backup.mkdir(parents=True)
    if index.exists():shutil.copy2(index,backup/'seasons.json')
    receipt_path=destination/'import_receipt.json'
    if receipt_path.exists():shutil.copy2(receipt_path,backup/'import_receipt.json')
    receipt={'importedAt':stamp,'generation':pointer['run'],'seasons':years,
             'fileSha256':{str(y)+'/'+name:hashlib.sha256((sources[y]/name).read_bytes()).hexdigest() for y in years for name in FILES}}
    imported=[]
    try:
        for year in years:
            target=season_root/str(year)
            if target.exists():shutil.copytree(target,backup/str(year))
            staging=Path(tempfile.mkdtemp(prefix=f'.import-{year}-',dir=season_root))
            try:
                for name in FILES:shutil.copyfile(sources[year]/name,staging/name)
                imported.append(year)
                if target.exists():shutil.rmtree(target)
                staging.replace(target)
            finally:
                if staging.exists():shutil.rmtree(staging)
        atomic_json(index,sorted(set(existing)|set(years),reverse=True))
        atomic_json(receipt_path,receipt)
    except Exception:
        # Roll back changed seasons if a copy or index write fails.
        for year in imported:
            target=season_root/str(year)
            if target.exists():shutil.rmtree(target)
            if (backup/str(year)).exists():shutil.copytree(backup/str(year),target)
        if (backup/'seasons.json').exists():shutil.copy2(backup/'seasons.json',index)
        elif index.exists():index.unlink()
        if (backup/'import_receipt.json').exists():shutil.copy2(backup/'import_receipt.json',receipt_path)
        elif receipt_path.exists():receipt_path.unlink()
        raise
    print(f'Imported seasons: {", ".join(map(str,years))}\nBackend data: {destination}\nBackup: {backup}')
    print('Restart the local backend (or redeploy Render) to clear cached season data.')

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--ready',required=True,type=Path,help='Collector wn​​ba_data/ready directory'.replace('\u200b',''))
    p.add_argument('--backend',required=True,type=Path,help='Existing backend/GamePulse.Api directory')
    p.add_argument('--seasons',nargs='+',type=int,default=[2024])
    args=p.parse_args()
    if any(y<1997 or y>9999 for y in args.seasons):p.error('Invalid season')
    try:run(args.ready,args.backend,sorted(set(args.seasons)));return 0
    except Exception as exc:print(f'Import failed: {exc}',file=sys.stderr);return 1
if __name__=='__main__':sys.exit(main())
