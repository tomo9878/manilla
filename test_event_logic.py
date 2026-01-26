import sys
import os

# Dummy data
units = [{"id": "1C_1-5", "name": "1C_1-5", "status": "fresh"}]
us_controlled_tags = ["Urban"] 

sys.path.append(os.path.join(os.getcwd(), 'backend'))

from game_logic import GameLogic
logic = GameLogic()

print("--- TEST 1: Turn 1 Exception (Pause -> No Result) ---")
# Rolling for Pause (e.g. 5, 6, 7, 8, 13, 14) is random.
# We need to monkey patch random or loop until we hit it?
# The class uses random.randint. Let's subclass to mock.

class MockGameLogic(GameLogic):
    def __init__(self, fixed_rolls):
        self.fixed_rolls = fixed_rolls # List of tuples (d1, d2, d3)
        self.roll_idx = 0
        
    def process_random_event(self, *args, **kwargs):
        # We can't easily mock random.randint inside the method without patching.
        # So we'll just use patching.
        return super().process_random_event(*args, **kwargs)

import random

# Mock random.randint to return specific values
original_randint = random.randint

def mock_randint_factory(sequence):
    # sequence is list of values to pop
    vals = list(sequence)
    vals.reverse()
    def mock(a, b):
        return vals.pop()
    return mock

# Test Case A: Turn 1 Pause (Roll 5 = 1+2+2)
print("Mocking Roll 5 (1, 2, 2) on Turn 1...")
random.randint = mock_randint_factory([1, 2, 2])
res = logic.process_random_event(1, None, us_controlled_tags, units, 19)
print(f"Turn 1 Result: {res['event']['name']} (Type: {res['event']['type']})")

# Test Case B: Consecutive Pause
# Step 1: Turn 3 1st Cav Pause (Roll 5)
print("\nMocking Roll 5 (1, 2, 2) on Turn 3...")
random.randint = mock_randint_factory([1, 2, 2])
res_t3 = logic.process_random_event(3, None, us_controlled_tags, units, 19)
print(f"Turn 3 Result: {res_t3['event']['name']}")
last_event = res_t3['event']

# Step 2: Turn 4 1st Cav Pause (Roll 6 = 2, 2, 2) -> Should be No Result
print("Mocking Roll 6 (2, 2, 2) on Turn 4 (Same event)...")
random.randint = mock_randint_factory([2, 2, 2])
res_t4 = logic.process_random_event(4, last_event, us_controlled_tags, units, 19)
print(f"Turn 4 Result: {res_t4['event']['name']}")

# Step 3: Turn 5 37th Inf Pause (Roll 7 = 3, 2, 2) -> Should be Valid (Different target)
print("Mocking Roll 7 (3, 2, 2) on Turn 5 (Diff event)...")
random.randint = mock_randint_factory([3, 2, 2])
res_t5 = logic.process_random_event(5, res_t4['event'], us_controlled_tags, units, 19)
print(f"Turn 5 Result: {res_t5['event']['name']}")

# Test Case C: Iwabuchi with NO Urban control
print("\nMocking Roll 15 (5, 5, 5) with NO Urban control...")
random.randint = mock_randint_factory([5, 5, 5])
res_iwa = logic.process_random_event(5, None, [], units, 19) # Empty tags
print(f"Result: {res_iwa['event']['name']}")

# Restore
random.randint = original_randint
print("\nDone.")
