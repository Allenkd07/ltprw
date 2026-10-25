"""Runtime settings, read from environment variables with sensible local defaults."""

import os
from dataclasses import dataclass, field
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent


@dataclass(frozen=True)
class Settings:
    data_dir: Path = Path(os.getenv("DATA_DIR", BACKEND_ROOT / "data"))
    # Built React app; served by FastAPI in the Docker image, absent in local dev.
    static_dir: Path = Path(os.getenv("STATIC_DIR", BACKEND_ROOT / "static"))
    cors_origins: list[str] = field(
        default_factory=lambda: os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    )


settings = Settings()
