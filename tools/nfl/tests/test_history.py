import copy
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import prepare_nfl as nfl
from test_prepare_nfl import fixture

class HistoryTests(unittest.TestCase):
    def test_unassigned_team_fragment_preserved(self):
        data=fixture();extra=copy.deepcopy(data['team_stats'][0]);extra.update(team=None,game_id=data['schedule'][0]['game_id'])
        data['team_stats'].append(extra);original=copy.deepcopy(data)
        out,c=nfl.build(2025,data)
        self.assertEqual(len(out['team_stats']),2);self.assertEqual(c['unassignedTeamStatRows'],1)
        self.assertEqual(c['unassignedPlayerStatRows'],0);self.assertIsNone(out['unassigned_stats'][0]['teamId'])
        self.assertEqual(out['unassigned_stats'][0]['sourceKind'],'team_stats');self.assertEqual(data,original)
    def test_unassigned_team_without_game_rejected(self):
        data=fixture();data['team_stats'][0]['team']=None
        with self.assertRaises(ValueError):nfl.build(2025,data)
    def test_placeholder_zero_id_is_unassigned_not_a_player(self):
        data=fixture();extra=copy.deepcopy(data['player_stats'][0]);extra.update(player_id='0',player_name=None,player_display_name=None)
        data['player_stats'].append(extra);out,c=nfl.build(2025,data)
        self.assertFalse(any(p['playerId']=='0' for p in out['players']));self.assertEqual(c['unassignedPlayerStatRows'],1)
        self.assertIsNone(out['unassigned_stats'][0]['playerId']);self.assertEqual(out['unassigned_stats'][0]['sourcePlayerId'],'0')
    def test_historical_aliases(self):
        for a,b in {'ARZ':'ARI','CLV':'CLE','BLT':'BAL','HST':'HOU','SL':'LAR'}.items():
            self.assertEqual(nfl.team(a),b)
    def test_missing_team_resolved_by_gsis_and_explicit_game(self):
        data=fixture(); row=data['player_stats'][0];row.update(team=None,game_id=data['schedule'][0]['game_id'])
        original=copy.deepcopy(data)
        out,c=nfl.build(2025,data)
        self.assertEqual(out['player_stats'][0]['teamId'],'BUF');self.assertEqual(c['resolvedPlayerTeamRows'],1)
        self.assertEqual(c['playerTeamResolutions'][0]['playerId'],'00-00001');self.assertEqual(data,original)
    def test_missing_team_without_explicit_game_rejected(self):
        data=fixture();data['player_stats'][0]['team']=None
        with self.assertRaises(ValueError):nfl.build(2025,data)
    def test_ambiguous_roster_teams_rejected(self):
        data=fixture();data['player_stats'][0].update(team=None,game_id=data['schedule'][0]['game_id'])
        data['rosters'].append({**data['rosters'][0],'team':'KC'})
        with self.assertRaises(ValueError):nfl.build(2025,data)
    def test_wrong_explicit_game_rejected(self):
        data=fixture();data['player_stats'][0].update(team=None,game_id='wrong')
        with self.assertRaises(ValueError):nfl.build(2025,data)
    def test_wrong_week_rejected(self):
        data=fixture();data['player_stats'][0].update(team=None,game_id=data['schedule'][0]['game_id'],week=21)
        with self.assertRaises(ValueError):nfl.build(2025,data)
    def test_opponent_disagreement_still_rejected(self):
        data=fixture();data['player_stats'][0].update(team=None,game_id=data['schedule'][0]['game_id'],opponent_team='BUF')
        with self.assertRaises(ValueError):nfl.build(2025,data)
    def test_unknown_nonempty_team_not_reassigned(self):
        data=fixture();data['player_stats'][0].update(team='UNKNOWN',game_id=data['schedule'][0]['game_id'])
        with self.assertRaises(ValueError):nfl.build(2025,data)

if __name__=='__main__':unittest.main()
