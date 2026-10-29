"""Automated tests for Step-0 Pre-Flight Hardware, Disk, and WSL2 Auditor."""

import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts import preflight_hardware_audit as audit  # noqa: E402

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


def _contains_emoji(text: str) -> bool:
    return bool(EMOJI_PATTERN.search(text))


def test_run_audit_produces_valid_metrics_and_artifacts() -> None:
    """Verify audit executes cleanly, generates valid metrics, and writes sanitized artifacts."""
    report = audit.run_audit()

    assert isinstance(report, dict)
    assert "system" in report
    assert "volumes" in report
    assert "recommendations" in report

    sys_info = report["system"]
    assert sys_info["logical_cpus"] >= 1
    assert sys_info["total_ram_gb"] > 0.0
    assert sys_info["available_ram_gb"] > 0.0

    volumes = report["volumes"]
    assert len(volumes) >= 1
    for drv, stats in volumes.items():
        assert drv.endswith(":")
        assert stats["total_gb"] > 0.0
        assert stats["free_gb"] >= 0.0

    assert audit.REPORT_PATH.exists()
    persisted_raw = audit.REPORT_PATH.read_text(encoding="utf-8")
    assert "CeX" not in persisted_raw
    persisted = json.loads(persisted_raw)
    assert persisted["system"]["total_ram_gb"] == sys_info["total_ram_gb"]

    assert audit.WSL_REC_PATH.exists()
    wsl_content = audit.WSL_REC_PATH.read_text(encoding="utf-8")
    assert "[wsl2]" in wsl_content
    assert "memory=" in wsl_content
    assert "processors=" in wsl_content
    assert "swap=2GB" in wsl_content
    assert "localhostForwarding=true" in wsl_content


def test_zero_emojis_and_line_limits_across_repository() -> None:
    """Enforce zero emojis on all files and <= 250 lines on Step-0 code/ADR files."""
    checked_files = [
        REPO_ROOT / "scripts" / "preflight_hardware_audit.py",
        REPO_ROOT / "docs" / "adr" / "ADR-000-local-container-resource-governance.md",
        REPO_ROOT / "docs" / "runbooks" / "00-host-hardware-and-wsl2-setup.md",
        REPO_ROOT / "docs" / "runbooks" / "hardware_audit_report.json",
        REPO_ROOT / "infra" / "wsl" / ".wslconfig.recommended",
        REPO_ROOT / ".antigravity" / "rules" / "engineering-standards.md",
    ]
    for file_path in checked_files:
        assert file_path.exists(), f"Missing expected file: {file_path}"
        content = file_path.read_text(encoding="utf-8")
        assert not _contains_emoji(content), f"Emoji detected in {file_path}"
        if file_path.suffix.lower() == ".md" and "runbooks" in file_path.parts:
            continue
        line_count = len(content.splitlines())
        assert line_count <= 250, f"File {file_path} exceeds 250 lines ({line_count})"
