"""Capture live browser screenshots and composite real E2E demonstration GIF."""

import sys
import time
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright

REPO_ROOT = Path(__file__).resolve().parent.parent
ASSETS_DIR = REPO_ROOT / "docs" / "assets"
ASSETS_DIR.mkdir(parents=True, exist_ok=True)

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"


def wait_for_text_content(page, selector: str, target_text: str, timeout_sec: float = 30.0) -> bool:
    """Poll until the element's text contains target_text or timeout."""
    start = time.time()
    while time.time() - start < timeout_sec:
        try:
            el = page.query_selector(selector)
            if el:
                txt = el.inner_text()
                if target_text in txt:
                    return True
        except Exception:
            pass
        page.wait_for_timeout(500)
    return False


def run_e2e_browser_capture() -> None:
    """Execute live interactive browser testing across :3000 and :8080."""
    print("[INFO] Starting Playwright with real Chromium browser...")
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=CHROME_PATH,
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        context = browser.new_context(
            viewport={"width": 1440, "height": 900},
            device_scale_factor=1.0,
        )
        page = context.new_page()

        # =====================================================================
        # 1. Executive Console on http://localhost:3000
        # =====================================================================
        print("[INFO] Navigating to http://localhost:3000...")
        page.goto("http://localhost:3000", wait_until="networkidle")
        page.wait_for_selector("#btnResetZero", timeout=10000)
        page.wait_for_timeout(1000)

        # Baseline Reset
        print("[INFO] Resetting state to baseline...")
        page.click("#btnResetZero")
        page.wait_for_timeout(1500)

        # Screenshot 0: Stage 0 Baseline Idle
        shot0 = ASSETS_DIR / "live-browser-3000-stage0-baseline.png"
        page.screenshot(path=str(shot0), full_page=False)
        print(f"[OK] Captured: {shot0.name} ({shot0.stat().st_size} bytes)")

        # Test 1: Run Initial Sync (Phase 1) -> 9,800 Synced, 200 DLQ
        print("[INFO] Clicking '1. Run Initial Sync'...")
        page.click("#btnRunSync")
        print("[INFO] Waiting for Initial Sync completion (9,800 Synced, 200 DLQ)...")
        wait_for_text_content(page, "#kpiSynced", "9,800", timeout_sec=35.0)
        wait_for_text_content(page, "#kpiErrors", "200", timeout_sec=10.0)
        page.wait_for_timeout(1500)

        # Screenshot 1: Phase 1 DLQ Quarantined
        shot1 = ASSETS_DIR / "live-browser-3000-phase1-dlq.png"
        page.screenshot(path=str(shot1), full_page=False)
        print(f"[OK] Captured: {shot1.name} ({shot1.stat().st_size} bytes)")

        # Test 2: Filter Detected Errors (DLQ)
        print("[INFO] Clicking 'Detected Errors (DLQ)' KPI card...")
        page.click("#cardErrors")
        page.wait_for_timeout(1000)

        # Test 3: AI Diagnose & Repair -> Converge to 10,000
        print("[INFO] Clicking '2. AI Diagnose & Repair'...")
        page.click("#btnRunRepair")
        print("[INFO] Waiting for DLQ replay to converge to 10,000...")
        wait_for_text_content(page, "#kpiSynced", "10,000", timeout_sec=35.0)
        wait_for_text_content(page, "#kpiErrors", "0", timeout_sec=10.0)
        page.wait_for_timeout(1000)

        # Step 3: Verify SHA-256 Cache (Phase 4)
        print("[INFO] Clicking '3. Verify SHA-256 Cache'...")
        page.click("#btnRunIdemp")
        print("[INFO] Waiting for SHA-256 cache verification (901 Skipped)...")
        wait_for_text_content(page, "#kpiSkipped", "901", timeout_sec=25.0)
        page.wait_for_timeout(1500)

        # Screenshot 2: Phase 4 Converged (10,000 Synced, 200 Repaired, 901 Skipped)
        shot2 = ASSETS_DIR / "live-browser-3000-phase4-converged.png"
        page.screenshot(path=str(shot2), full_page=False)
        print(f"[OK] Captured: {shot2.name} ({shot2.stat().st_size} bytes)")

        # Test 4: Server-Side Search & Floating (i) Tooltip
        print("[INFO] Clicking 'All Synced Customers' card and searching '5432'...")
        page.click("#cardAll")
        page.wait_for_timeout(500)
        # Scroll so table toolbar and rows are clearly framed
        page.locator("#tableSearchInput").scroll_into_view_if_needed()
        page.wait_for_timeout(300)
        page.fill("#tableSearchInput", "5432")
        page.dispatch_event("#tableSearchInput", "input")
        page.wait_for_timeout(1000)

        # Open floating tooltip popover right on the table toolbar
        print("[INFO] Opening floating tooltip popover on Schema Mapping...")
        schema_btn = page.query_selector("#btnSchemaMapping")
        if schema_btn:
            schema_btn.click()
        page.wait_for_timeout(1000)

        # Screenshot 3: Search and Floating Tooltip
        shot3 = ASSETS_DIR / "live-browser-3000-search-and-tooltip.png"
        page.screenshot(path=str(shot3), full_page=False)
        print(f"[OK] Captured: {shot3.name} ({shot3.stat().st_size} bytes)")

        # =====================================================================
        # 2. Apache Airflow 2.10 Webserver on http://localhost:8080
        # =====================================================================
        print("[INFO] Navigating to http://localhost:8080/login/...")
        page.goto("http://localhost:8080/login/", wait_until="networkidle")
        page.wait_for_selector("#username", timeout=10000)

        print("[INFO] Logging in with admin credentials...")
        page.fill("#username", "admin")
        page.fill("#password", "datapulse2026")
        page.click("input[type='submit']")
        page.wait_for_timeout(2500)

        # Navigate to DAG Grid View
        dag_grid_url = "http://localhost:8080/dags/datapulse_hubspot_profitability_sync/grid"
        print(f"[INFO] Navigating to DAG Grid View: {dag_grid_url}...")
        page.goto(dag_grid_url, wait_until="networkidle")
        page.wait_for_timeout(4000)

        # Screenshot 4: Airflow DAG Grid View with Success States
        shot4 = ASSETS_DIR / "live-browser-8080-airflow-dag-success.png"
        page.screenshot(path=str(shot4), full_page=False)
        print(f"[OK] Captured: {shot4.name} ({shot4.stat().st_size} bytes)")

        # Navigate to Cluster Activity
        cluster_url = "http://localhost:8080/cluster_activity"
        print(f"[INFO] Navigating to Cluster Activity: {cluster_url}...")
        page.goto(cluster_url, wait_until="networkidle")
        page.wait_for_timeout(4000)

        # Screenshot 5: Cluster Activity Healthy Status
        shot5 = ASSETS_DIR / "live-browser-8080-airflow-cluster-healthy.png"
        page.screenshot(path=str(shot5), full_page=False)
        print(f"[OK] Captured: {shot5.name} ({shot5.stat().st_size} bytes)")

        browser.close()
        print("[INFO] Browser automation finished successfully.")


def compile_live_dashboard_gif() -> None:
    """Assemble the 6 captured real browser screenshots into an animated GIF."""
    shots = [
        ASSETS_DIR / "live-browser-3000-stage0-baseline.png",
        ASSETS_DIR / "live-browser-3000-phase1-dlq.png",
        ASSETS_DIR / "live-browser-3000-phase4-converged.png",
        ASSETS_DIR / "live-browser-3000-search-and-tooltip.png",
        ASSETS_DIR / "live-browser-8080-airflow-dag-success.png",
        ASSETS_DIR / "live-browser-8080-airflow-cluster-healthy.png",
    ]

    for s in shots:
        if not s.is_file():
            print(f"[ERROR] Required screenshot missing: {s}")
            sys.exit(1)

    print("[INFO] Compiling real browser screenshots into datapulse-live-dashboard.gif...")
    frames = []
    # Target resolution: 1080x675 (scaled from 1440x900 maintaining 16:10 aspect ratio)
    target_size = (1080, 675)

    for s in shots:
        with Image.open(s) as im:
            rgb_im = im.convert("RGB")
            resized = rgb_im.resize(target_size, Image.Resampling.LANCZOS)
            # Quantize to adaptive 256-color palette
            quantized = resized.quantize(colors=256, method=Image.Quantize.MEDIANCUT)
            frames.append(quantized)

    gif_output = ASSETS_DIR / "datapulse-live-dashboard.gif"
    # Display each frame for 2.2 seconds (2200ms) with infinite loop
    durations = [2200] * len(frames)
    frames[0].save(
        gif_output,
        save_all=True,
        append_images=frames[1:],
        duration=durations,
        loop=0,
        optimize=True,
    )
    print(f"[OK] Generated {gif_output.name} ({gif_output.stat().st_size} bytes, {len(frames)} frames)")


def main() -> int:
    """Run capture and compilation."""
    run_e2e_browser_capture()
    compile_live_dashboard_gif()
    return 0


if __name__ == "__main__":
    sys.exit(main())
