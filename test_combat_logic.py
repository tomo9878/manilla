
import unittest
from backend.game_logic import GameLogic

class TestCombatLogic(unittest.TestCase):
    def setUp(self):
        self.logic = GameLogic()

    def test_overrun_check(self):
        """Test Overrun conditions."""
        
        # 1. Success but no overrun (Diff < DF)
        # AT=10, DT=5, Diff=5. Defender DF=6.
        # 5 > 0 (Success), but 5 < 6 (No Overrun).
        res = self.logic.process_overrun_check(10, 5, 6)
        self.assertTrue(res['is_success'])
        self.assertFalse(res['is_overrun'])
        
        # 2. Overrun (Diff > DF)
        # AT=10, DT=3, Diff=7. Defender DF=6.
        # 7 > 6 (Overrun).
        res = self.logic.process_overrun_check(10, 3, 6)
        self.assertTrue(res['is_success'])
        self.assertTrue(res['is_overrun'])
        
        # 3. Failed attack
        # AT=3, DT=5, Diff=-2.
        res = self.logic.process_overrun_check(3, 5, 6)
        self.assertFalse(res['is_success'])
        self.assertFalse(res['is_overrun'])

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
