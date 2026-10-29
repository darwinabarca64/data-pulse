"""Automated governance verification tests for Step 1: Clean Architecture & Snowflake FinOps."""

import re
from pathlib import Path
from typing import List

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

EXCLUDED_DIRS = {".git", ".pytest_cache", "__pycache__", ".venv", "venv", "node_modules", "dist", "data_pulse.egg-info"}


def _all_repo_text_files() -> List[Path]:
    files: List[Path] = []
    for path in REPO_ROOT.rglob("*"):
        if path.is_file() and not any(part in EXCLUDED_DIRS for part in path.parts):
            files.append(path)
    return files


def test_clean_architecture_monorepo_directories_and_skills_exist() -> None:
    """Verify Clean Architecture directories, package markers, and Antigravity skills exist."""
    expected_dirs = [
        REPO_ROOT / "core-engine" / "src" / "datapulse" / "domain",
        REPO_ROOT / "core-engine" / "src" / "datapulse" / "application",
        REPO_ROOT / "core-engine" / "src" / "datapulse" / "infrastructure",
        REPO_ROOT / "core-engine" / "src" / "datapulse" / "interfaces",
        REPO_ROOT / "core-engine" / "tests",
        REPO_ROOT / "connectors-ts" / "src" / "domain",
        REPO_ROOT / "connectors-ts" / "src" / "application",
        REPO_ROOT / "connectors-ts" / "src" / "infrastructure",
        REPO_ROOT / "connectors-ts" / "tests",
        REPO_ROOT / "orchestration" / "dags",
        REPO_ROOT / "orchestration" / "plugins",
        REPO_ROOT / "orchestration" / "tests",
        REPO_ROOT / "syncs",
    ]
    for directory in expected_dirs:
        assert directory.is_dir(), f"Missing Clean Architecture directory: {directory}"

    expected_skills = [
        REPO_ROOT / ".antigravity" / "skills" / "sql-finops-auditor.md",
        REPO_ROOT / ".antigravity" / "skills" / "clean-architecture-enforcer.md",
    ]
    for skill in expected_skills:
        assert skill.is_file(), f"Missing Antigravity skill file: {skill}"


def test_env_example_and_pyproject_configuration() -> None:
    """Verify .env.example and pyproject.toml define all required keys."""
    env_example = REPO_ROOT / ".env.example"
    assert env_example.is_file()
    content = env_example.read_text(encoding="utf-8")

    required_keys = [
        "SOURCE_ENGINE=duckdb_local",
        "DUCKDB_DATABASE_PATH=data/local_warehouse.duckdb",
        "SNOWFLAKE_ACCOUNT=",
        "SNOWFLAKE_USER=SVC_DATA_PULSE",
        "SNOWFLAKE_ROLE=ROLE_DATA_PULSE_SERVICE",
        "SNOWFLAKE_WAREHOUSE=WH_DATA_PULSE_XS",
        "SNOWFLAKE_DATABASE=ANALYTICS_PROD",
        "SNOWFLAKE_SCHEMA=MARTS",
        "SNOWFLAKE_PRIVATE_KEY_PATH=infra/keys/rsa_key.p8",
        "HUBSPOT_API_BASE_URL=http://localhost:3000",
        "HUBSPOT_API_KEY=",
        "WEBHOOK_HMAC_SECRET=",
        "ALERT_PROVIDER=console",
        "DISCORD_WEBHOOK_URL=",
        "SLACK_WEBHOOK_URL=",
        "AI_PROVIDER=heuristic_local",
        "GEMINI_API_KEY=",
        "OPENAI_API_KEY=",
    ]
    for key in required_keys:
        assert key in content, f"Missing required .env.example entry: {key}"

    pyproject = REPO_ROOT / "pyproject.toml"
    assert pyproject.is_file()
    assert 'name = "data-pulse"' in pyproject.read_text(encoding="utf-8")


def test_snowflake_finops_guardrails_sql() -> None:
    """Verify 00_finops_guardrails.sql enforces all 3 FinOps guardrails."""
    sql_path = REPO_ROOT / "infra" / "snowflake" / "00_finops_guardrails.sql"
    assert sql_path.is_file()
    sql = sql_path.read_text(encoding="utf-8")

    assert "WH_DATA_PULSE_XS" in sql
    assert "WAREHOUSE_SIZE = 'XSMALL'" in sql
    assert "AUTO_SUSPEND = 60" in sql
    assert "STATEMENT_TIMEOUT_IN_SECONDS = 300" in sql
    assert "STATEMENT_QUEUED_TIMEOUT_IN_SECONDS = 120" in sql
    assert "RESOURCE MONITOR" in sql
    assert "CREDIT_QUOTA = 50" in sql
    assert "SUSPEND_IMMEDIATE" in sql
    assert "REVOKE MODIFY ON WAREHOUSE WH_DATA_PULSE_XS FROM ROLE ROLE_DATA_PULSE_SERVICE" in sql
    assert len(sql.splitlines()) < 120


def test_snowflake_security_rbac_sql() -> None:
    """Verify 01_security_rbac.sql enforces RSA Key-Pair auth, PoLP, Masking, and RLS."""
    sql_path = REPO_ROOT / "infra" / "snowflake" / "01_security_rbac.sql"
    assert sql_path.is_file()
    sql = sql_path.read_text(encoding="utf-8")

    assert "ROLE_DATA_PULSE_SERVICE" in sql
    assert "SVC_DATA_PULSE" in sql
    assert "RSA_PUBLIC_KEY" in sql
    assert "MUST_CHANGE_PASSWORD = FALSE" in sql
    assert "ANALYTICS_PROD.MARTS.FCT_CUSTOMER_PROFITABILITY" in sql
    assert "ANALYTICS_PROD.AUDIT.DATA_PULSE_DLQ" in sql
    assert "ANALYTICS_PROD.AUDIT.DATA_PULSE_WATERMARKS" in sql
    assert "MASKING POLICY" in sql
    assert "ROW ACCESS POLICY" in sql
    assert len(sql.splitlines()) < 150


def test_adr_and_repository_governance_constraints() -> None:
    """Verify ADR-001 <= 30 lines and all repository files <= 250 lines with zero emojis."""
    adr_path = REPO_ROOT / "docs" / "adr" / "ADR-001-snowflake-finops-and-zero-trust-rbac.md"
    assert adr_path.is_file()
    adr_text = adr_path.read_text(encoding="utf-8")
    adr_lines = adr_text.splitlines()
    assert len(adr_lines) <= 30, f"ADR-001 exceeds 30 lines ({len(adr_lines)})"
    for section in ("## Status", "## Context", "## Decision", "## Consequences"):
        assert section in adr_text

    runbook_path = REPO_ROOT / "docs" / "runbooks" / "01-snowflake-finops-and-rbac-provisioning.md"
    assert runbook_path.is_file()
    assert len(runbook_path.read_text(encoding="utf-8").splitlines()) < 200

    for file_path in _all_repo_text_files():
        content = file_path.read_text(encoding="utf-8")
        assert not EMOJI_PATTERN.search(content), f"Emoji detected in {file_path}"
        line_count = len(content.splitlines())
        assert line_count <= 250, f"File {file_path} exceeds 250-line cap ({line_count})"

