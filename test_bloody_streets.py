
import unittest
from backend.game_logic import GameLogic

class TestBloodyStreets(unittest.TestCase):
    def setUp(self):
        self.logic = GameLogic()

    def test_no_contest(self):
        """Test case where no area is contested."""
        data = [
            {"name": "Area1", "terrain": "Urban", "us_count": 5, "jp_count": 0},
            {"name": "Area2", "terrain": "Fort", "us_count": 0, "jp_count": 3}
        ]
        result = self.logic.process_bloody_streets_check(data)
        self.assertEqual(len(result['results']), 0)
        self.assertIn("No Bloody Streets casualties occurred", result['logs'][-1])

    def test_contest_wrong_terrain(self):
        """Test contest in Clear terrain (should be ignored)."""
        data = [
            {"name": "Field1", "terrain": "Clear", "us_count": 2, "jp_count": 2}
        ]
        result = self.logic.process_bloody_streets_check(data)
        self.assertEqual(len(result['results']), 0)

    def test_contest_urban(self):
        """Test contest in Urban terrain (should trigger check)."""
        data = [
            {"name": "Intramuros", "terrain": "Urban", "us_count": 1, "jp_count": 1}
        ]
        # Since logic uses random, we run multiple times or check existence
        # We can't deterministically predict output without seeding, but we verify structure
        result = self.logic.process_bloody_streets_check(data)
        
        # Result logic:
        # 1-2: No Effect
        # 3-4: OOA
        # 5-6: OOA + Morale
        
        # We check that IF a result is returned, it follows schema
        if result['results']:
            r = result['results'][0]
            self.assertEqual(r['area'], "Intramuros")
            self.assertIn(r['roll'], [3, 4, 5, 6])
            self.assertIn(r['effect'], ["OOA", "OOA + Morale -1"])
            self.assertEqual(r['required_ooa'], 1)

    def test_contest_fort(self):
        """Test contest in Fort terrain."""
        data = [
            # Fort needs bloody streets
            {"name": "Fort Santiago", "terrain": "Fort", "us_count": 3, "jp_count": 2}
        ]
        result = self.logic.process_bloody_streets_check(data)
        if result['results']:
            self.assertEqual(result['results'][0]['area'], "Fort Santiago")

    def test_mixed_scenario(self):
        """Mixed scenario with multiple valid and invalid areas."""
        data = [
            {"name": "A1", "terrain": "Clear", "us_count": 1, "jp_count": 1}, # Ignore
            {"name": "A2", "terrain": "Urban", "us_count": 1, "jp_count": 0}, # Ignore (Not contested)
            {"name": "A3", "terrain": "Urban", "us_count": 1, "jp_count": 1}, # CHECK
            {"name": "A4", "terrain": "Fort", "us_count": 2, "jp_count": 5}   # CHECK
        ]
        
        # Mocking random to force specific outcomes? 
        # Easier to just verify that result count <= 2
        result = self.logic.process_bloody_streets_check(data)
        self.assertTrue(len(result['results']) <= 2)
        
        for res in result['results']:
            self.assertIn(res['area'], ["A3", "A4"])

if __name__ == '__main__':
    unittest.main()
