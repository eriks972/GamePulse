"""Run with Python 3.10+; creates only disposable fixture repositories."""
import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest

MODULE = Path(__file__).resolve().parents[2] / 'tools/storage_health.py'
spec = importlib.util.spec_from_file_location('health', MODULE)
health = importlib.util.module_from_spec(spec)
spec.loader.exec_module(health)


class StorageHealthChecks(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.repo = Path(self.temp.name).resolve()
        subprocess.run(['git', 'init', '-q', str(self.repo)], check=True)
        (self.repo / '.gitignore').write_text('**/bin/\n')
        self.project = self.repo / 'backend/GamePulse.Api'
        self.project.mkdir(parents=True)
        (self.project / 'GamePulse.Api.csproj').write_text('<Project/>')
        self.copy = self.project / 'bin/Release/net10.0/Data/processed/nfl/data.gz'
        self.copy.parent.mkdir(parents=True)
        self.copy.write_bytes(b'build-copy')
        self.source = self.project / 'Data/processed/nfl/data.gz'
        self.source.parent.mkdir(parents=True)
        self.source.write_bytes(b'authoritative-source')
        self.published = self.project / 'bin/Release/net10.0/publish/Data/processed/nfl/data.gz'
        self.published.parent.mkdir(parents=True)
        self.published.write_bytes(b'publish-copy')

    def run_tool(self, *args):
        return subprocess.run(['python3', str(MODULE), '--repo', str(self.repo), *args], capture_output=True, text=True)

    def test_report_only(self):
        r = self.run_tool('--json')
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertTrue(self.copy.exists())
        self.assertIn('removableBuildCopies', r.stdout)

    def test_apply_and_repeat_preserves_source_publish_and_dll(self):
        dll = self.copy.parents[3] / 'GamePulse.Api.dll'
        dll.write_text('code')
        for _ in range(2):
            r = self.run_tool('--apply')
            self.assertEqual(r.returncode, 0, r.stderr)
        self.assertFalse(self.copy.exists())
        self.assertEqual(self.source.read_bytes(), b'authoritative-source')
        self.assertTrue(self.published.exists())
        self.assertTrue(dll.exists())

    def test_tracked_copy_refused_without_deletion(self):
        subprocess.run(['git', '-C', str(self.repo), 'add', '-f', str(self.copy)], check=True)
        r = self.run_tool('--apply')
        self.assertNotEqual(r.returncode, 0)
        self.assertTrue(self.copy.exists())

    def test_nested_symlink_refused(self):
        (self.copy.parent / 'source-link').symlink_to(self.source)
        r = self.run_tool('--apply')
        self.assertNotEqual(r.returncode, 0)
        self.assertTrue(self.copy.exists())
        self.assertTrue(self.source.exists())

    def test_symlinked_bin_refused(self):
        self.copy.parents[5].rename(self.project / 'saved-bin')
        (self.project / 'bin').symlink_to(self.project / 'saved-bin', target_is_directory=True)
        self.assertNotEqual(self.run_tool('--apply').returncode, 0)

    def test_non_repository_refused(self):
        p = subprocess.run(['python3', str(MODULE), '--repo', str(self.repo / 'other')], capture_output=True)
        self.assertNotEqual(p.returncode, 0)

    def test_hardlinks_count_once(self):
        import os
        os.link(self.source, self.source.with_name('second.gz'))
        value = health.usage(self.source.parent)
        self.assertEqual(value['logicalBytes'], len(b'authoritative-source') * 2)
        self.assertEqual(value['allocatedBytes'], self.source.stat().st_blocks * 512)


if __name__ == '__main__':
    unittest.main()
