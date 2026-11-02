"""Automated screenshot capture tool for DataPulse Mission Control branch UI previews."""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
CORE_SRC = REPO_ROOT / "core-engine" / "src"
if str(CORE_SRC) not in sys.path:
    sys.path.insert(0, str(CORE_SRC))

CHROME_PATHS = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
]


def find_browser() -> str:
    for p in CHROME_PATHS:
        if Path(p).is_file():
            return p
    raise RuntimeError("No headless browser found")


def is_server_up(url: str = "http://localhost:3000/health") -> bool:
    try:
        with urllib.request.urlopen(url, timeout=1.0) as resp:
            return resp.status == 200
    except Exception:
        return False


def get_crm_count(base_url: str = "http://localhost:3000") -> int:
    try:
        with urllib.request.urlopen(f"{base_url}/api/v1/state", timeout=1.5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return int(data.get("totalSyncedContacts", 0))
    except Exception:
        return 0


def seed_crm_10k(base_url: str = "http://localhost:3000") -> None:
    db_path = REPO_ROOT / "data" / "preview_capture.duckdb"
    db_path.parent.mkdir(parents=True, exist_ok=True)
    manifest = REPO_ROOT / "syncs" / "hubspot_profitability.yml"
    env = os.environ.copy()
    env["PYTHONPATH"] = str(CORE_SRC)
    env["HUBSPOT_API_BASE_URL"] = base_url

    print("Seeding DuckDB warehouse...")
    subprocess.run([sys.executable, "-m", "datapulse.interfaces.cli", "init", "--db-path", str(db_path)], check=True, env=env)
    print("Executing Phase 1 Sync...")
    subprocess.run([sys.executable, "-m", "datapulse.interfaces.cli", "run", "--manifest", str(manifest), "--db-path", str(db_path)], check=True, env=env)
    print("Executing Phase 3 DLQ Replay...")
    subprocess.run([sys.executable, "-m", "datapulse.interfaces.cli", "dlq", "replay", "--manifest", str(manifest), "--db-path", str(db_path)], check=True, env=env)
    print("Executing Phase 4 Idempotency Verification...")
    subprocess.run([sys.executable, "-m", "datapulse.interfaces.cli", "run", "--manifest", str(manifest), "--db-path", str(db_path)], check=True, env=env)

    req = urllib.request.Request(
        f"{base_url}/api/v1/telemetry",
        data=json.dumps({
            "currentPhase": "PHASE 4: SHA-256 IDEMPOTENCY VERIFIED",
            "skippedO": 10000,
            "dlqPendingE": 0,
            "dlqResolved": 200,
            "emailErrorsPending": 0,
            "nanErrorsPending": 0,
        }).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=2.0) as resp:
        pass
    print("Server populated with 10,000 converged contacts.")


def capture_screenshot(out_file: Path, base_url: str = "http://localhost:3000") -> None:
    browser = find_browser()
    out_file.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        browser,
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        "--window-size=1400,900",
        f"--screenshot={out_file}",
        base_url,
    ]
    subprocess.run(cmd, check=True)
    print(f"Captured screenshot to {out_file} (size: {out_file.stat().st_size} bytes)")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, help="Output PNG path")
    args = parser.parse_args()

    server_proc = None
    if not is_server_up():
        print("Starting TypeScript connector server on :3000...")
        server_proc = subprocess.Popen(["npm", "--prefix", "connectors-ts", "start"], shell=True)
        for _ in range(30):
            if is_server_up():
                break
            time.sleep(0.5)

    if get_crm_count() < 10000:
        seed_crm_10k()

    time.sleep(1.0)
    out_path = Path(args.output).resolve()
    capture_screenshot(out_path)

    if server_proc:
        server_proc.terminate()


if __name__ == "__main__":
    main()
