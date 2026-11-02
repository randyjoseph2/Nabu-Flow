"""Load the pure-Python modules without importing Home Assistant.

custom_components/nabu_flow/__init__.py imports Home Assistant, so tests
register the folder as a bare package instead of importing it normally.
"""

import sys
import types
from pathlib import Path

PKG_DIR = Path(__file__).resolve().parents[1] / "custom_components" / "nabu_flow"

pkg = types.ModuleType("nabu_flow_pure")
pkg.__path__ = [str(PKG_DIR)]
sys.modules["nabu_flow_pure"] = pkg
