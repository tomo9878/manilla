
import unittest
from backend.game_logic import GameLogic

class TestCombatLogic(unittest.TestCase):
    def setUp(self):
        self.logic = GameLogic()

    def test_combat_resolution(self):
        """Test Combat Resolution structure."""
        # AT = 10, DF = 2, Mod = 0
        # Min Roll for AT: 10 + 2 = 12
        # Max Roll for DT: 2 + 0 + 0 + 12 = 14
        # It's possible to fail (12 vs 14).
        # It's possible to overrun (AT 22 vs DT 4 -> Diff 18 > DF 2).
        
        res = self.logic.process_combat(10, 2, 0, 0)
        
        self.assertIn('at_roll', res)
        self.assertIn('dt_roll', res)
        self.assertIn('is_success', res)
        self.assertIn('is_overrun', res)
        
        # Verify calculation consistency
        at_total = 10 + res['at_roll']
        dt_total = 2 + 0 + 0 + res['dt_roll']
        self.assertEqual(res['at_total'], at_total)
        self.assertEqual(res['dt_total'], dt_total)
        
        diff = at_total - dt_total
        self.assertEqual(res['diff'], diff)
        
        if res['is_overrun']:
            self.assertTrue(res['is_success'])
            self.assertTrue(diff > 2) # DF was 2

    def test_end_combat_phase(self):
        """Test resetting units and morale drop."""
        units = [
            {"id": "u1", "status": "spent"},
            {"id": "u2", "status": "fresh"},
            {"id": "u3", "status": "out_of_action"}
        ]
        morale = 10
        
        res = self.logic.process_end_combat_phase(units, morale)
        
        updated_units = res['units']
        new_morale = res['morale']
        
        # Check u1 reset
        u1 = next(u for u in updated_units if u['id'] == "u1")
        self.assertEqual(u1['status'], "fresh")
        
        # Check u2 unchanged
        u2 = next(u for u in updated_units if u['id'] == "u2")
        self.assertEqual(u2['status'], "fresh")
        
        # Check u3 unchanged (OOA stays OOA until Dawn Phase)
        u3 = next(u for u in updated_units if u['id'] == "u3")
        self.assertEqual(u3['status'], "out_of_action")
        
        # Check morale -1
        self.assertEqual(new_morale, 9)

if __name__ == '__main__':
    unittest.main()
