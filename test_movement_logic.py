
import unittest
import os
import json
from backend.game_logic import GameLogic

class TestMovementLogic(unittest.TestCase):
    def setUp(self):
        self.logic = GameLogic()

    def test_adjacency_basic(self):
        # We know Area 1 connects to Area 9 and 10 based on generated data
        adj = self.logic.get_adjacency("Area 1")
        self.assertIn("Area 9", adj)
        self.assertIn("Area 10", adj)

    def test_movement_cost_vacant_safe(self):
        """Standard move to safe vacant area = 1 MF."""
        all_units = []
        # Area 1 -> Area 9 (safe)
        res = self.logic.calculate_movement_cost("Area 1", "Area 9", all_units)
        self.assertTrue(res['valid'], f"Msg: {res['message']}")
        self.assertEqual(res['cost'], 1)
        self.assertFalse(res['mandatory_attack'])

    def test_movement_cost_zoc(self):
        """Move to vacant area adjacent to JP = 2 MF."""
        # Target: Area 10.
        # Neighbor of Target: Area 11.
        # Setup: JP in Area 11.
        # Move: Area 1 -> Area 10. (1 is adjacent to 10)
        
        all_units = [
            {"id": "jp1", "faction": "JP", "location": "Area 11", "status": "fresh"}
        ]
        
        res = self.logic.calculate_movement_cost("Area 1", "Area 10", all_units)
        
        self.assertTrue(res['valid'], f"Msg: {res['message']}")
        self.assertEqual(res['cost'], 2, "Cost should be 2 because Area 10 is adjacent to JP in Area 11")

    def test_movement_into_enemy(self):
        """Move into JP occupied area."""
        # Move Area 1 -> Area 9 (JP present)
        
        # 1. Revealed (Cost 3)
        all_units = [
            {"id": "jp1", "faction": "JP", "location": "Area 9", "status": "fresh", "is_revealed": True}
        ]
        res = self.logic.calculate_movement_cost("Area 1", "Area 9", all_units)
        self.assertTrue(res['valid'], f"Msg: {res['message']}")
        self.assertEqual(res['cost'], 3)
        self.assertTrue(res['mandatory_attack'])

        # 2. Unrevealed (Cost 4)
        all_units_hidden = [
            {"id": "jp1", "faction": "JP", "location": "Area 9", "status": "fresh", "is_revealed": False}
        ]
        res = self.logic.calculate_movement_cost("Area 1", "Area 9", all_units_hidden)
        self.assertEqual(res['cost'], 4)

if __name__ == '__main__':
    unittest.main()
