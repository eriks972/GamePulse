import copy
import gzip
import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import import_snapshots as importer

class ImportTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name);self.source=self.root/'source';self.dest=self.root/'api'
    def tearDown(self):self.tmp.cleanup()
    def fixture(self,root,year):
        run='20261028T000000-12345678';m=dict(schemaVersion=1,league='NFL',season=year,runId=run,generatedAtUtc='2026-10-28T00:00:00+00:00',files={},coverage={})
        for key in importer.KEYS:
            rel=f'seasons/{year}/runs/{run}/{key}.json.gz';p=root/rel;p.parent.mkdir(parents=True,exist_ok=True)
            raw=gzip.compress(json.dumps(dict(schemaVersion=1,league='NFL',season=year,count=0,data=[])).encode());p.write_bytes(raw)
            m['files'][key]=dict(path=rel,encoding='gzip',count=0,bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest())
        importer.write(root/f'seasons/{year}/current.json',m);return m
    def test_merge_preserves_existing_year_bytes_and_rebuilds_index(self):
        self.fixture(self.source,1999);self.fixture(self.dest,2026)
        original={str(p.relative_to(self.dest)):p.read_bytes() for p in self.dest.rglob('*') if p.is_file()}
        self.assertEqual(importer.merge(self.source,self.dest),[1999])
        self.assertTrue(all((self.dest/rel).read_bytes()==b for rel,b in original.items()))
        index=json.loads((self.dest/'seasons.json').read_text());self.assertEqual([m['season'] for m in index['data']],[1999,2026])
    def test_repeat_is_noop_for_current_snapshots(self):
        self.fixture(self.source,1999);importer.merge(self.source,self.dest)
        first=(self.dest/'seasons/1999/current.json').read_bytes();self.assertEqual(importer.merge(self.source,self.dest),[])
        self.assertEqual((self.dest/'seasons/1999/current.json').read_bytes(),first)
    def test_incoming_does_not_replace_existing_year(self):
        self.fixture(self.source,1999);self.fixture(self.dest,1999)
        pointer=self.dest/'seasons/1999/current.json';m=json.loads(pointer.read_text());m['coverage']['preserve']='local';importer.write(pointer,m)
        importer.merge(self.source,self.dest);self.assertEqual(json.loads(pointer.read_text())['coverage']['preserve'],'local')
    def test_corruption_prevents_any_new_activation(self):
        self.fixture(self.source,1999);m=self.fixture(self.source,2000);p=self.source/m['files']['games']['path'];p.write_bytes(b'bad')
        with self.assertRaises(ValueError):importer.merge(self.source,self.dest)
        self.assertFalse(list(self.dest.glob('seasons/*/current.json')))
    def test_traversal_rejected(self):
        m=self.fixture(self.source,1999);m['files']['games']['path']='../outside.gz';importer.write(self.source/'seasons/1999/current.json',m)
        with self.assertRaises(ValueError):importer.merge(self.source,self.dest)
    def test_disk_copy_failure_cleans_stage_and_keeps_existing(self):
        self.fixture(self.source,1999);self.fixture(self.dest,2026)
        original=(self.dest/'seasons/2026/current.json').read_bytes()
        with patch.object(importer.shutil,'copyfile',side_effect=OSError('No space')):
            with self.assertRaises(OSError):importer.merge(self.source,self.dest)
        self.assertEqual((self.dest/'seasons/2026/current.json').read_bytes(),original)
        self.assertFalse(list(self.dest.glob('seasons/1999/runs/.importing-*')))
        self.assertFalse((self.dest/'seasons/1999/current.json').exists())
    def test_index_failure_retains_published_year_and_resumes(self):
        self.fixture(self.source,1999);real=importer.write
        def failing(path,value):
            if path==self.dest/'seasons.json':raise OSError('Index failure')
            real(path,value)
        with patch.object(importer,'write',side_effect=failing):
            with self.assertRaises(OSError):importer.merge(self.source,self.dest)
        self.assertTrue((self.dest/'seasons/1999/current.json').exists())
        self.assertEqual(importer.merge(self.source,self.dest),[]);self.assertTrue((self.dest/'seasons.json').exists())
    def test_gzip_integrity_checked_even_with_matching_manifest_hash(self):
        m=self.fixture(self.source,1999);raw=b'not gzip';p=self.source/m['files']['games']['path'];p.write_bytes(raw)
        m['files']['games'].update(bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest());importer.write(self.source/'seasons/1999/current.json',m)
        with self.assertRaises(OSError):importer.merge(self.source,self.dest)

if __name__=='__main__':unittest.main()
