"""Governance verification tests for Step 5: TypeScript Connector & ADR-005."""

import re
from pathlib import Path
from typing import List

REPO_ROOT = Path(__file__).resolve().parent.parent.parent

EMOJI_PATTERN = re.compile(
    "["
    "\U0001F600-\U0001F64F"
    "\U0001F300-\U0001F5FF"
    "\U0001F680-\U0001F6FF"
    "\U0001F1E0-\U0001F1FF"
    "\U00002702-\U000027B0"
    "\U000024C2-\U0001F251"
    "]+",
    flags=re.UNICODE,
)

EXCLUDED_DIRS = {".git", ".pytest_cache", "__pycache__", ".venv", "venv", "node_modules", "dist"}


def test_step5_typescript_modules_exist_and_comply_with_governance() -> None:
    """Verify TypeScript connector files, ADR-005 <= 30 lines, and repo <= 250 lines."""
    expected_ts_files = [
        REPO_ROOT / "connectors-ts" / "package.json",
        REPO_ROOT / "connectors-ts" / "tsconfig.json",
        REPO_ROOT / "connectors-ts" / "src" / "domain" / "contracts.ts",
        REPO_ROOT / "connectors-ts" / "src" / "application" / "resilience.ts",
        REPO_ROOT / "connectors-ts" / "src" / "infrastructure" / "dashboard_view.ts",
        REPO_ROOT / "connectors-ts" / "src" / "infrastructure" / "server.ts",
        REPO_ROOT / "connectors-ts" / "tests" / "index.test.ts",
    ]
    for ts_file in expected_ts_files:
        assert ts_file.is_file(), f"Missing TypeScript connector file: {ts_file}"

    adr5_path = (
        REPO_ROOT / "docs" / "adr" / "ADR-005-typescript-zod-connector-and-full-jitter-backoff.md"
    )
    assert adr5_path.is_file()
    adr5_text = adr5_path.read_text(encoding="utf-8")
    assert len(adr5_text.splitlines()) <= 30
    for section in ("## Status", "## Context", "## Decision", "## Consequences"):
        assert section in adr5_text

    runbook5_path = (
        REPO_ROOT / "docs" / "runbooks" / "05-typescript-crm-connector-and-live-dashboard.md"
    )
    assert runbook5_path.is_file()
    assert len(runbook5_path.read_text(encoding="utf-8").splitlines()) < 160

    files: List[Path] = [
        p
        for p in REPO_ROOT.rglob("*")
        if p.is_file() and not any(part in EXCLUDED_DIRS for part in p.parts)
    ]
    for file_path in files:
        content = file_path.read_text(encoding="utf-8")
        assert not EMOJI_PATTERN.search(content), f"Emoji detected in {file_path}"
        line_count = len(content.splitlines())
        assert line_count <= 250, f"File {file_path} exceeds 250 lines ({line_count})"

