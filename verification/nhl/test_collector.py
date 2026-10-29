import copy,gzip,importlib.util,json,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('collector',ROOT/'tools/nhl/collect_nhl.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

def source():
 schedule=[];teams=[];players=[];scoring=[];lines=[]
 for i,(home,away,finish) in enumerate([(2,1,'REG'),(2,1,'OT'),(2,1,'SO')],1):
  gid=2025020000+i;schedule.append(dict(game_id=gid,game_type='R',game_date=f'2025-10-0{i}',home_team_abbr='A',away_team_abbr='B',home_team_name='Alpha',away_team_name='Beta',home_score=home,away_score=away,game_state='OFF'))
  lines.append(dict(game_id=gid,home_team_id=1,home_team_abbr='A',away_team_id=2,away_team_abbr='B',has_shootout=finish=='SO'))
  for side,tid,abbr,goals in [('home',1,'A',home),('away',2,'B',away)]:
   teams.append(dict(game_id=gid,season=20252026,home_away=side,team_id=tid,team_abbrev=abbr,team_name=abbr,goals=goals,shots_on_goal=10))
   players.append(dict(game_id=gid,season=20252026,home_away=side,team_id=tid,player_id=tid,player_name=abbr,position='C',toi='10:01',goals=1,assists=0,points=1,shots_on_goal=2,plus_minus=-1))
  scoring.extend([dict(game_id=gid,eventId=1,isHome=True,period_number=1,period_type='REG',timeInPeriod='01:00'),dict(game_id=gid,eventId=2,isHome=False,period_number=1,period_type='REG',timeInPeriod='02:00'),dict(game_id=gid,eventId=3,isHome=True,period_number=3 if finish=='REG' else 4 if finish=='OT' else 5,period_type=finish,timeInPeriod='01:00')])
 return dict(schedule=schedule,teams=teams,players=players,scoring=scoring,lines=lines,rosters=[])

class CollectorChecks(unittest.TestCase):
 def test_outcomes(self):
  d=m.prepare(2026,source());self.assertEqual([g['finish'] for g in d['games']],['REG','OT','SO']);self.assertTrue(all(g['scoringComplete'] for g in d['games']))
 def test_shootout_goal_overrides_false_line_flag(self):
  s=source();s['lines'][2]['has_shootout']=False;d=m.prepare(2026,s);self.assertEqual(d['games'][2]['finish'],'SO');self.assertIn('shootout_flag_conflict',d['coverage']['issueCounts'])
 def test_signed_plus_minus_and_seconds(self):
  row=m.prepare(2026,source())['playerStats'][0];self.assertEqual(row['statistics']['plusMinus'],-1);self.assertEqual(row['statistics']['toiSeconds'],601)
 def test_bad_points_quarantined_raw_unchanged(self):
  s=source();s['players'][0]['points']=99;original=copy.deepcopy(s);d=m.prepare(2026,s);self.assertIsNone(d['playerStats'][0]['statistics']['points']);self.assertEqual(s,original);self.assertIn('skater_points_conflict',d['coverage']['issueCounts'])
 def test_missing_event_never_assumes_regulation(self):
  s=source();s['scoring']=[];d=m.prepare(2026,s);self.assertEqual([g['finish'] for g in d['games']],['Unknown','Unknown','SO'])
 def test_backup_not_an_appearance(self):
  s=source();s['players'].append(dict(game_id=2025020001,season=20252026,home_away='home',team_id=1,player_id=9,position=None,starter=False,toi='00:00',saves=0,shots_against=0,goals_against=0));d=m.prepare(2026,s);self.assertEqual(d['coverage']['excludedBackupRows'],1);self.assertFalse(any(r['playerId']=='nhl:player:9' for r in d['playerStats']))
 def test_goalie_conflict_and_overtime_loss(self):
  s=source();s['players'].append(dict(game_id=2025020001,season=20252026,home_away='home',team_id=1,player_id=9,position=None,starter=True,toi='60:00',saves=10,shots_against=10,goals_against=2,decision='O'));d=m.prepare(2026,s);r=d['playerStats'][-1]['statistics'];self.assertIsNone(r['saves']);self.assertEqual(r['overtimeLosses'],1);self.assertEqual(r['losses'],0)
 def test_duplicates_rejected(self):
  s=source();s['players'].append(s['players'][0].copy())
  with self.assertRaises(ValueError):m.prepare(2026,s)
 def test_season_mismatch_rejected(self):
  s=source();s['players'][0]['season']=20242025
  with self.assertRaises(ValueError):m.prepare(2026,s)
 def test_wrong_opponent_rejected(self):
  s=source();s['players'][0]['team_id']=7
  with self.assertRaises(ValueError):m.prepare(2026,s)
 def test_missing_game_identity_rejected(self):
  s=source();s['players'][0].pop('game_id')
  with self.assertRaises(ValueError):m.prepare(2026,s)
 def test_time_not_decimal(self):
  self.assertEqual(m.seconds('5:02'),302);self.assertIsNone(m.seconds('5.2'));self.assertIsNone(m.seconds('1:60'));self.assertIsNone(m.number(True))
 def test_compressed_activation_retirement_and_integrity(self):
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp);d=m.prepare(2026,source());m.activate(root,d);old=m.verify(root,2026)[1];m.activate(root,d);self.assertFalse(old.exists());self.assertEqual(len(list(root.rglob('season.json.gz'))),1);_,file=m.verify(root,2026);file.write_bytes(b'bad')
   with self.assertRaises(ValueError):m.verify(root,2026)
 def test_failed_pointer_preserves_old_and_removes_orphan(self):
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp);d=m.prepare(2026,source());m.activate(root,d);before=(root/'seasons/2026/current.json').read_bytes()
   with patch.object(m,'write',side_effect=OSError('disk full')):
    with self.assertRaises(OSError):m.activate(root,d)
   self.assertEqual((root/'seasons/2026/current.json').read_bytes(),before);m.verify(root,2026);self.assertEqual(len(list(root.rglob('season.json.gz'))),1)
if __name__=='__main__':unittest.main()
