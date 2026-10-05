import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "services", "orchestrator"))

try:
    import main
    print("SUCCESS: main.py imported cleanly")
except Exception as e:
    import traceback
    traceback.print_exc()
    sys.exit(1)
