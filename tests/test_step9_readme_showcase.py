"""Automated verification tests for Step 9: Root README.md Showcase, SVG Assets, and pyproject.toml."""

import re
import xml.etree.ElementTree as ET
from pathlib import Path

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
    svg_files = [
        REPO_ROOT / "docs" / "assets" / "cli-drill-preview.svg",
        REPO_ROOT / "docs" / "assets" / "dashboard-preview.svg",
    ]
    for svg_path in svg_files:
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
    readme_lines = readme_text.splitlines()

    assert len(readme_lines) >= 250, f"README.md below 250 lines ({len(readme_lines)})"
    assert not EMOJI_PATTERN.search(readme_text), "Emoji detected in README.md"
    assert readme_text.count("```mermaid") >= 2, "README.md must contain at least 2 Mermaid diagrams"

    required_tokens = [
        "docs/assets/cli-drill-preview.svg",
        "docs/assets/dashboard-preview.svg",
        "docs/INDEX.md",
        "Mode 1:",
        "Mode 2:",
        "Mode 3:",
        "python scripts/live_incident_drill.py",
        "http://localhost:3000",
        "Step A",
        "Step B",
        "Step C",
        "Step D",
        "Step E",
        "--no-seed",
        "DEMO_SEED_ENABLED=false",
        "$4,170.00",
    ]
    for token in required_tokens:
        assert token in readme_text, f"README.md missing required token: '{token}'"

    for adr_name in EXPECTED_ADRS:
        assert adr_name in readme_text, f"README.md missing link to {adr_name}"

    for rb_name in EXPECTED_RUNBOOKS:
        assert rb_name in readme_text, f"README.md missing link to {rb_name}"


def test_pyproject_points_to_root_readme() -> None:
    """Verify pyproject.toml specifies readme = 'README.md'."""
    pyproject_text = (REPO_ROOT / "pyproject.toml").read_text(encoding="utf-8")
    assert 'readme = "README.md"' in pyproject_text

