"""Infrastructure adapter for loading and validating declarative YAML sync manifests."""

from pathlib import Path
from typing import Any

import yaml
from pydantic import ValidationError

from datapulse.domain.manifest import SyncManifest


def load_sync_manifest(path: str | Path) -> SyncManifest:
    """Read a YAML sync contract with UTF-8 encoding and validate into SyncManifest."""
    manifest_path = Path(path).resolve()
    if not manifest_path.is_file():
        raise FileNotFoundError(
            f"[ERROR] Declarative sync manifest file not found: {manifest_path}"
        )

    raw_text = manifest_path.read_text(encoding="utf-8")
    try:
        parsed: Any = yaml.safe_load(raw_text)
    except yaml.YAMLError as exc:
        raise ValueError(
            f"[ERROR] Failed to parse YAML syntax in {manifest_path}: {exc}"
        ) from exc

    if not isinstance(parsed, dict):
        raise ValueError(
            f"[ERROR] Sync manifest root must be a YAML mapping in {manifest_path}"
        )

    try:
        return SyncManifest.model_validate(parsed)
    except ValidationError as exc:
        raise ValueError(
            f"[ERROR] Sync manifest contract violation in {manifest_path}: {exc}"
        ) from exc

