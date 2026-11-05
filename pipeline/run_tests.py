"""Run every pipeline test: python3 -I pipeline/run_tests.py"""
import sys
import unittest
from pathlib import Path

suite = unittest.defaultTestLoader.discover(str(Path(__file__).resolve().parent / 'tests'))
sys.exit(0 if unittest.TextTestRunner(verbosity=1).run(suite).wasSuccessful() else 1)
