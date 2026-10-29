"""Automated verification tests for Step 8: 4-Gate CI/CD, Mermaid Diagrams, ADRs, and Zero-Km Hygiene."""

import re
import subprocess
from pathlib import Path
from typing import Any, List

import yaml

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
DOC_EXEMPT_NAMES = {"INDEX.md", "README.md", "AUDIT-REPORT.md", "MANUAL-MAESTRO-DARWIN-ES.md"}


def _is_doc_exempt_from_line_cap(path: Path) -> bool:
    return path.suffix.lower() == ".md" and (
        "runbooks" in path.parts or path.name in DOC_EXEMPT_NAMES
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


def test_github_actions_four_gate_ci_workflow() -> None:
    """Verify .github/workflows/ci-quality-gates.yml is valid YAML and defines all 4 gates."""
    wf_path = REPO_ROOT / ".github" / "workflows" / "ci-quality-gates.yml"
    assert wf_path.is_file()
    raw_text = wf_path.read_text(encoding="utf-8")
    assert len(raw_text.splitlines()) < 120

    parsed: dict[str, Any] = yaml.safe_load(raw_text)
    assert isinstance(parsed, dict)
    triggers = parsed.get("on") or parsed.get(True)
    assert isinstance(triggers, dict)
    assert "push" in triggers
    assert "pull_request" in triggers

    steps = parsed["jobs"]["quality-gates"]["steps"]
    step_names = [str(s.get("name", "")) for s in steps]
    assert any("Gate 1:" in n for n in step_names)
    assert any("Gate 2:" in n for n in step_names)
    assert any("Gate 3:" in n for n in step_names)
    assert any("Gate 4:" in n for n in step_names)


def test_all_nine_adrs_and_nine_runbooks_and_index_portal() -> None:
    """Verify ADRs 000-008 (20..30 lines), Runbooks 00-08 (>= 160/220 lines + Mermaid), and INDEX.md."""
    index_path = REPO_ROOT / "docs" / "INDEX.md"
    assert index_path.is_file()
    index_text = index_path.read_text(encoding="utf-8")
    index_lines = len(index_text.splitlines())
    assert index_lines >= 110, f"docs/INDEX.md below 110 lines ({index_lines})"
    assert "```mermaid" in index_text, "docs/INDEX.md missing Mermaid diagram block"

    for adr_name in EXPECTED_ADRS:
        adr_path = REPO_ROOT / "docs" / "adr" / adr_name
        assert adr_path.is_file(), f"Missing ADR: {adr_name}"
        adr_text = adr_path.read_text(encoding="utf-8")
        line_count = len(adr_text.splitlines())
        assert 20 <= line_count <= 30, f"{adr_name} line count {line_count} not in [20, 30]"
        for section in ("## Status", "## Context", "## Decision", "## Consequences"):
            assert section in adr_text, f"{adr_name} missing section {section}"
        assert adr_name in index_text, f"docs/INDEX.md missing link to {adr_name}"

    for rb_name in EXPECTED_RUNBOOKS:
        rb_path = REPO_ROOT / "docs" / "runbooks" / rb_name
        assert rb_path.is_file(), f"Missing Runbook: {rb_name}"
        rb_text = rb_path.read_text(encoding="utf-8")
        rb_lines = len(rb_text.splitlines())
        assert rb_name in index_text, f"docs/INDEX.md missing link to {rb_name}"
        assert "```mermaid" in rb_text, f"{rb_name} missing Mermaid diagram block"

        if rb_name.startswith("07-"):
            assert rb_lines >= 220, f"{rb_name} below 220 lines ({rb_lines})"
            for required_token in (
                "python scripts/live_incident_drill.py",
                "Terminal 1",
                "Terminal 2",
                "Step A",
                "Step B",
                "Step C",
                "Step D",
                "Step E",
                "http://localhost:3000",
                "--no-seed",
                "DEMO_SEED_ENABLED=false",
                "/api/v1/reset",
            ):
                assert required_token in rb_text, f"Runbook 07 missing '{required_token}'"
        else:
            assert rb_lines >= 160, f"{rb_name} below 160 lines ({rb_lines})"


def test_zero_kilometer_git_hygiene_and_spanish_master_book() -> None:
    """Verify git ls-files tracks zero local artifacts and validate MANUAL-MAESTRO-DARWIN-ES.md."""
    audit_report = REPO_ROOT / "AUDIT-REPORT.md"
    assert not audit_report.exists(), "Temporary AUDIT-REPORT.md must be deleted after remediation"

    gitignore_text = (REPO_ROOT / ".gitignore").read_text(encoding="utf-8")
    assert "MANUAL-MAESTRO-DARWIN-ES.md" in gitignore_text

    proc = subprocess.run(
        ["git", "ls-files"],
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=True,
    )
    tracked_files = [line.strip() for line in proc.stdout.splitlines() if line.strip()]
    assert "docs/runbooks/hardware_audit_report.json" not in tracked_files
    assert "infra/wsl/.wslconfig.recommended" not in tracked_files
    assert "AUDIT-REPORT.md" not in tracked_files
    assert "MANUAL-MAESTRO-DARWIN-ES.md" not in tracked_files

    for rel_path in tracked_files:
        full_path = REPO_ROOT / rel_path
        if full_path.is_file():
            content = full_path.read_text(encoding="utf-8")
            assert "C:\\Users\\CeX" not in content, f"Personal path leaked in {rel_path}"
            assert "C:/Users/CeX" not in content, f"Personal path leaked in {rel_path}"
            assert "D:\\programs" not in content, f"Personal path leaked in {rel_path}"

    master_book = REPO_ROOT / "MANUAL-MAESTRO-DARWIN-ES.md"
    if master_book.is_file():
        book_text = master_book.read_text(encoding="utf-8")
        assert len(book_text.splitlines()) >= 1000
        assert not EMOJI_PATTERN.search(book_text)
        assert "```mermaid" in book_text
        for idx in range(9):
            assert f"ADR-00{idx}" in book_text, f"Master book missing ADR-00{idx}"
            assert f"Capítulo 0{idx}" in book_text, f"Master book missing Capítulo 0{idx}"


def test_step8_repository_wide_line_limit_and_zero_emojis() -> None:
    """Verify every source/config file is <= 250 lines and every file contains zero emojis."""
    files: List[Path] = [
        p
        for p in REPO_ROOT.rglob("*")
        if p.is_file() and not any(part in EXCLUDED_DIRS for part in p.parts)
    ]
    for file_path in files:
        content = file_path.read_text(encoding="utf-8")
        assert not EMOJI_PATTERN.search(content), f"Emoji detected in {file_path}"
        if _is_doc_exempt_from_line_cap(file_path):
            continue
        line_count = len(content.splitlines())
        assert line_count <= 250, f"File {file_path} exceeds 250 lines ({line_count})"
