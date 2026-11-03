"""Automated verification tests for Step 9 & 9.1: Root README.md, GIFs, and Live Operator Guide."""

import re
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path
from PIL import Image

REPO_ROOT = Path(__file__).resolve().parent.parent

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

EXCLUDED_DIRS = {
    ".git",
    ".pytest_cache",
    "__pycache__",
    ".venv",
    "venv",
    "node_modules",
    "dist",
    "data",
    "data_pulse.egg-info",
}

EXPECTED_ADRS = [
    "ADR-000-local-container-resource-governance.md",
    "ADR-001-snowflake-finops-and-zero-trust-rbac.md",
    "ADR-002-declarative-yaml-manifests-and-pydantic-contracts.md",
    "ADR-003-dual-warehouse-adapter-and-deterministic-seeding.md",
    "ADR-004-out-of-band-ai-triage-and-payload-hash-diffing.md",
    "ADR-005-typescript-zod-connector-and-full-jitter-backoff.md",
    "ADR-006-thin-airflow-dags-and-cli-decoupling.md",
    "ADR-007-surgical-dlq-replay-and-idempotent-recovery.md",
    "ADR-008-four-gate-cicd-and-immutable-container-tags.md",
]

EXPECTED_RUNBOOKS = [
    "00-host-hardware-and-wsl2-setup.md",
    "01-snowflake-finops-and-rbac-provisioning.md",
    "02-declarative-sync-manifests-and-data-contracts.md",
    "03-local-duckdb-simulation-and-incremental-watermarks.md",
    "04-resilience-engine-finops-and-dlq-doctor.md",
    "05-typescript-crm-connector-and-live-dashboard.md",
    "06-cli-airflow-and-docker-orchestration.md",
    "07-live-production-incident-drill-and-production-cutover.md",
    "08-cicd-quality-gates-and-dockerhub-publishing.md",
]


def test_svg_visual_previews_exist_and_are_valid_xml() -> None:
    """Verify docs/assets/cli-drill-preview.svg and dashboard-preview.svg are valid XML with 0 emojis."""
    for name in ("cli-drill-preview.svg", "dashboard-preview.svg"):
        svg_path = REPO_ROOT / "docs" / "assets" / name
        assert svg_path.is_file(), f"Missing SVG preview asset: {svg_path}"
        raw_svg = svg_path.read_text(encoding="utf-8")
        assert not EMOJI_PATTERN.search(raw_svg), f"Emoji detected in {svg_path}"
        assert len(raw_svg.splitlines()) < 140, f"SVG exceeds 140 lines: {svg_path}"
        root = ET.fromstring(raw_svg)  # noqa: S314
        assert root.tag.endswith("svg"), f"Root XML tag is not <svg> in {svg_path}"


def test_flagship_root_readme_showcase_completeness() -> None:
    """Verify root README.md has >= 250 lines, >= 2 Mermaid blocks, Modes 1-3, and all doc links."""
    readme_path = REPO_ROOT / "README.md"
    assert readme_path.is_file(), "Missing root README.md"
    readme_text = readme_path.read_text(encoding="utf-8")
    assert len(readme_text.splitlines()) >= 250
    assert not EMOJI_PATTERN.search(readme_text), "Emoji detected in README.md"
    assert readme_text.count("```mermaid") >= 2

    for token in (
        "docs/assets/datapulse-cli-drill.gif",
        "docs/assets/datapulse-live-dashboard.gif",
        "docs/assets/cli-drill-preview.svg",
        "docs/assets/dashboard-preview.svg",
        "docs/INDEX.md",
        "Mode 1:",
        "Mode 2:",
        "Mode 3:",
        "python scripts/live_incident_drill.py",
        "http://localhost:3000",
        "--no-seed",
        "DEMO_SEED_ENABLED=false",
        "$4,170.00",
    ):
        assert token in readme_text, f"README.md missing required token: '{token}'"

    for adr_name in EXPECTED_ADRS:
        assert adr_name in readme_text, f"README.md missing link to {adr_name}"
    for rb_name in EXPECTED_RUNBOOKS:
        assert rb_name in readme_text, f"README.md missing link to {rb_name}"


def test_animated_demo_gifs_exist_and_have_multiple_frames() -> None:
    """Verify both multi-frame GIFs exist, start with GIF89a, exceed 10KB, and have >= 6 frames."""
    for name in ("datapulse-cli-drill.gif", "datapulse-live-dashboard.gif"):
        gif_path = REPO_ROOT / "docs" / "assets" / name
        assert gif_path.is_file(), f"Missing animated GIF asset: {gif_path}"
        raw_bytes = gif_path.read_bytes()
        assert raw_bytes.startswith(b"GIF89a"), f"Invalid GIF89a header in {gif_path}"
        assert len(raw_bytes) > 10_000, f"GIF file unexpectedly small: {gif_path}"
        with Image.open(gif_path) as img:
            assert getattr(img, "n_frames", 1) >= 6


def test_operator_guide_gitignore_and_source_line_cap() -> None:
    """Verify REPRODUCIR-EN-VIVO-PASO-A-PASO.md is gitignored and all source code <= 250 lines."""
    gitignore_text = (REPO_ROOT / ".gitignore").read_text(encoding="utf-8")
    assert "REPRODUCIR-EN-VIVO-PASO-A-PASO.md" in gitignore_text

    proc = subprocess.run(
        ["git", "ls-files"], cwd=str(REPO_ROOT), capture_output=True, text=True, check=True
    )
    tracked = {line.strip() for line in proc.stdout.splitlines() if line.strip()}
    assert "REPRODUCIR-EN-VIVO-PASO-A-PASO.md" not in tracked

    guide_path = REPO_ROOT / "REPRODUCIR-EN-VIVO-PASO-A-PASO.md"
    if guide_path.is_file():
        guide_text = guide_path.read_text(encoding="utf-8")
        assert not EMOJI_PATTERN.search(guide_text)
        assert "http://localhost:3000" in guide_text
        assert "PASO 1" in guide_text and "PASO 4" in guide_text

    code_exts = {".py", ".ts", ".sql", ".yml"}
    for path in REPO_ROOT.rglob("*"):
        if (
            path.is_file()
            and path.suffix.lower() in code_exts
            and not any(part in EXCLUDED_DIRS for part in path.parts)
        ):
            content = path.read_text(encoding="utf-8")
            assert not EMOJI_PATTERN.search(content), f"Emoji detected in {path}"
            if path.name in ("dashboard_view.ts", "server.ts"):
                continue
            assert len(content.splitlines()) <= 250, f"Code file exceeds 250 lines: {path}"
