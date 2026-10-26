import copy
import gzip
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import prepare_nfl as nfl


def fixture():
    return {
        "schedule": [{"game_id": "2025_22_KC_BUF", "season": 2025, "week": 22,
                      "game_type": "SB", "home_team": "BUF", "away_team": "KC",
                      "home_score": 20, "away_score": 20, "gameday": "2026-02-08", "gametime": "18:30"}],
        "teams": [{"team_abbr": "BUF", "team_name": "Buffalo Bills"},
                  {"team_abbr": "KC", "team_name": "Kansas City Chiefs"}],
        "rosters": [{"season": 2025, "team": "BUF", "gsis_id": "00-00001", "full_name": "Example Player"}],
        "player_stats": [{"season": 2025, "season_type": "POST", "week": 22,
                          "team": "BUF", "player_id": "00-00001", "passing_yards": 0,
                          "def_sacks": 0.5, "receiving_yards": None}],
        "team_stats": [{"season": 2025, "season_type": "POST", "week": 22, "team": t,
                        "passing_yards": 123} for t in ("BUF", "KC")],
    }


class PipelineTests(unittest.TestCase):
    def test_postseason_retains_season_and_eastern_kickoff(self):
        output, coverage = nfl.build(2025, fixture())
        game = output["games"][0]
        self.assertEqual(game["season"], 2025)
        self.assertEqual(game["seasonType"], "POST")
        self.assertEqual(game["kickoffUtc"], "2026-02-08T23:30:00+00:00")
        self.assertEqual(coverage["missingCompletedTeamGames"], 0)

    def test_ties_not_losses_and_reg_post_separate(self):
        output, _ = nfl.build(2025, fixture())
        by_key = {(r["teamId"], r["seasonType"]): r for r in output["records"]}
        self.assertEqual(by_key[("BUF", "POST")]["ties"], 1)
        self.assertEqual(by_key[("BUF", "POST")]["losses"], 0)
        self.assertEqual(by_key[("BUF", "REG")]["played"], 0)

    def test_zero_null_fractional_defensive_stats_preserved(self):
        output, _ = nfl.build(2025, fixture())
        stats = output["player_stats"][0]["stats"]
        self.assertEqual(stats["passing_yards"], 0)
        self.assertEqual(stats["def_sacks"], 0.5)
        self.assertIsNone(stats["receiving_yards"])

    def test_unassigned_source_stats_preserved_separately(self):
        data = fixture()
        extra = copy.deepcopy(data["player_stats"][0])
        extra.update(player_id=None, penalties=2)
        data["player_stats"].append(extra)
        output, coverage = nfl.build(2025, data)
        self.assertEqual(len(output["player_stats"]), 1)
        self.assertEqual(output["unassigned_stats"][0]["stats"]["penalties"], 2)
        self.assertEqual(coverage["unassignedPlayerStatRows"], 1)

    def test_missing_scores_not_zero_final(self):
        data = fixture()
        data["schedule"][0].update(home_score=None, away_score=None)
        output, _ = nfl.build(2025, data)
        self.assertEqual(output["games"][0]["status"], "scheduled")
        self.assertIsNone(output["games"][0]["homeScore"])
        self.assertEqual(sum(r["played"] for r in output["records"]), 0)

    def test_duplicate_games_and_stats_fail(self):
        for dataset in ("schedule", "player_stats", "team_stats"):
            with self.subTest(dataset=dataset):
                data = fixture()
                data[dataset].append(copy.deepcopy(data[dataset][0]))
                with self.assertRaisesRegex(ValueError, "duplicate"):
                    nfl.build(2025, data)

    def test_unmatched_stats_fail(self):
        data = fixture()
        data["player_stats"][0]["week"] = 1
        with self.assertRaisesRegex(ValueError, "no schedule match"):
            nfl.build(2025, data)

    def test_aliases_and_trades_keep_same_player(self):
        data = fixture()
        data["schedule"][0]["home_team"] = "LA"
        data["teams"][0]["team_abbr"] = "LAR"
        data["rosters"][0]["team"] = "LAR"
        data["rosters"].append({"season": 2025, "team": "KC", "gsis_id": "00-00001"})
        data["player_stats"][0]["team"] = "LA"
        data["team_stats"][0]["team"] = "LAR"
        output, _ = nfl.build(2025, data)
        self.assertEqual(output["games"][0]["homeTeamId"], "LAR")
        self.assertEqual(len(output["players"]), 1)
        self.assertEqual(set(output["players"][0]["teamIds"]), {"LAR", "KC"})

    def test_failed_refresh_preserves_published_manifest(self):
        class Source:
            fail = False
            def load(self, dataset, season):
                if self.fail and dataset == "player_stats":
                    raise OSError("simulated network failure")
                return fixture()[dataset], {"url": "fixture-only"}
        with tempfile.TemporaryDirectory() as directory:
            source = Source()
            self.assertEqual(nfl.collect(directory, [2025], source), 0)
            pointer = Path(directory) / "processed/seasons/2025/current.json"
            original = pointer.read_bytes()
            source.fail = True
            self.assertEqual(nfl.collect(directory, [2025], source), 1)
            self.assertEqual(pointer.read_bytes(), original)
            self.assertEqual(json.loads((Path(directory) / "reports/latest_attempt.json").read_text())["seasons"][0]["status"], "failed")

    def test_partial_coverage_requires_opt_in(self):
        class Source:
            def load(self, dataset, season):
                data = fixture()[dataset]
                return (data[:1] if dataset == "team_stats" else data), {}
        with tempfile.TemporaryDirectory() as directory:
            self.assertEqual(nfl.collect(directory, [2025], Source()), 1)
            self.assertFalse((Path(directory) / "processed/seasons/2025/current.json").exists())
            self.assertEqual(nfl.collect(directory, [2025], Source(), allow_partial=True), 0)

    def test_incomplete_write_does_not_change_pointer(self):
        with tempfile.TemporaryDirectory() as directory:
            output, coverage = nfl.build(2025, fixture())
            nfl.publish(directory, 2025, output, coverage, {})
            pointer = Path(directory) / "processed/seasons/2025/current.json"
            original = pointer.read_bytes()
            with patch.object(nfl, "write_compressed_json", side_effect=OSError("disk full")):
                with self.assertRaises(OSError):
                    nfl.publish(directory, 2025, output, coverage, {})
            self.assertEqual(pointer.read_bytes(), original)

    def test_manifest_files_are_readable_and_counts_match(self):
        with tempfile.TemporaryDirectory() as directory:
            output, coverage = nfl.build(2025, fixture())
            manifest = nfl.publish(directory, 2025, output, coverage, {})
            for info in manifest["files"].values():
                path = Path(directory) / "processed" / info["path"]
                with gzip.open(path, "rt", encoding="utf-8") as f:
                    document = json.load(f)
                self.assertEqual(len(document["data"]), info["count"])

    def test_offline_missing_cache_fails_without_network(self):
        with tempfile.TemporaryDirectory() as directory:
            source = nfl.ReleaseSource(directory, offline=True)
            with patch.object(nfl, "urlopen", side_effect=AssertionError("network used")):
                with self.assertRaises(FileNotFoundError):
                    source.load("schedule", 2025)

    def test_output_lock_blocks_second_writer(self):
        with tempfile.TemporaryDirectory() as directory:
            with nfl.collector_lock(directory):
                with self.assertRaisesRegex(RuntimeError, "Another NFL collector"):
                    with nfl.collector_lock(directory):
                        pass


if __name__ == "__main__":
    unittest.main()
