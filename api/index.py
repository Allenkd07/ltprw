"""Vercel serverless entry point: exposes the FastAPI app from backend/ as one Python function.

vercel.json rewrites /api/* here; the app's routes are already prefixed with /api.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.main import app  # noqa: E402, F401
