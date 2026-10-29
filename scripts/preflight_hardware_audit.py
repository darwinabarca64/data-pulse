"""Pre-flight hardware, disk, and WSL2 diagnostic audit for DataPulse."""

import ctypes
import json
import os
import platform
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

REPO_ROOT = Path(__file__).resolve().parent.parent
REPORT_PATH = REPO_ROOT / "docs" / "runbooks" / "hardware_audit_report.json"
WSL_REC_PATH = REPO_ROOT / "infra" / "wsl" / ".wslconfig.recommended"
BYTES_PER_GB = 1024**3


class _MemoryStatusEx(ctypes.Structure):
    _fields_ = [
        ("dwLength", ctypes.c_ulong),
        ("dwMemoryLoad", ctypes.c_ulong),
        ("ullTotalPhys", ctypes.c_ulonglong),
        ("ullAvailPhys", ctypes.c_ulonglong),
        ("ullTotalPageFile", ctypes.c_ulonglong),
        ("ullAvailPageFile", ctypes.c_ulonglong),
        ("ullTotalVirtual", ctypes.c_ulonglong),
        ("ullAvailVirtual", ctypes.c_ulonglong),
        ("sullAvailExtendedVirtual", ctypes.c_ulonglong),
    ]


def _sanitize_path_str(raw: str) -> str:
    """Replace local host user profile and repo paths with portable tokens."""
    sanitized = raw.replace(str(REPO_ROOT), "$REPO_ROOT").replace(str(Path.home()), "$USERPROFILE")
    if "USERPROFILE" in os.environ:
        sanitized = sanitized.replace(os.environ["USERPROFILE"], "$USERPROFILE")
    return sanitized


def get_system_resources() -> Dict[str, Any]:
    """Inspect physical RAM and logical CPU cores using Windows API or POSIX fallback."""
    cpu_count = os.cpu_count() or 1
    total_ram_gb, avail_ram_gb, mem_load_pct = 0.0, 0.0, 0
    if platform.system() == "Windows" and hasattr(ctypes, "windll"):
        mem = _MemoryStatusEx()
        mem.dwLength = ctypes.sizeof(_MemoryStatusEx)
        if ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(mem)):
            total_ram_gb = round(mem.ullTotalPhys / BYTES_PER_GB, 2)
            avail_ram_gb = round(mem.ullAvailPhys / BYTES_PER_GB, 2)
            mem_load_pct = int(mem.dwMemoryLoad)
    else:
        try:
            if hasattr(os, "sysconf"):
                total_ram_gb = round(
                    (os.sysconf("SC_PAGE_SIZE") * os.sysconf("SC_PHYS_PAGES")) / BYTES_PER_GB, 2
                )
            meminfo = Path("/proc/meminfo")
            if meminfo.is_file():
                for line in meminfo.read_text(encoding="utf-8").splitlines():
                    if line.startswith("MemAvailable:"):
                        avail_ram_gb = round((int(line.split()[1]) * 1024) / BYTES_PER_GB, 2)
                        break
        except (OSError, ValueError):
            pass
        if total_ram_gb <= 0.0:
            total_ram_gb = 16.0
        if avail_ram_gb <= 0.0:
            avail_ram_gb = round(total_ram_gb * 0.5, 2)
        mem_load_pct = int(round((1.0 - (avail_ram_gb / total_ram_gb)) * 100))

    return {
        "os": f"{platform.system()} {platform.release()} ({platform.version()})",
        "logical_cpus": cpu_count,
        "total_ram_gb": total_ram_gb,
        "available_ram_gb": avail_ram_gb,
        "memory_load_percent": mem_load_pct,
    }


def get_disk_volumes(drives: Optional[List[str]] = None) -> Dict[str, Dict[str, float]]:
    """Inspect Total, Used, and Free space in GB across Windows drives or POSIX root."""
    volumes: Dict[str, Dict[str, float]] = {}
    for drive in drives or ["C:", "D:", "E:", "F:"]:
        root = f"{drive}\\"
        if os.path.exists(root):
            try:
                u = shutil.disk_usage(root)
                volumes[drive] = {
                    "total_gb": round(u.total / BYTES_PER_GB, 2),
                    "used_gb": round(u.used / BYTES_PER_GB, 2),
                    "free_gb": round(u.free / BYTES_PER_GB, 2),
                }
            except OSError:
                continue
    if not volumes:
        u = shutil.disk_usage("/")
        volumes["C:"] = {
            "total_gb": round(u.total / BYTES_PER_GB, 2),
            "used_gb": round(u.used / BYTES_PER_GB, 2),
            "free_gb": round(u.free / BYTES_PER_GB, 2),
        }
    return volumes


def find_docker_vhdx_files() -> List[Dict[str, Any]]:
    """Locate Docker WSL2 virtual disks (.vhdx) under %LOCALAPPDATA%\\Docker\\wsl."""
    base = os.environ.get("LOCALAPPDATA", "")
    docker_wsl_dir = Path(base) / "Docker" / "wsl" if base else None
    results: List[Dict[str, Any]] = []
    if docker_wsl_dir and docker_wsl_dir.exists():
        for vhdx in docker_wsl_dir.rglob("*.vhdx"):
            try:
                results.append(
                    {
                        "path": _sanitize_path_str(str(vhdx)),
                        "size_gb": round(vhdx.stat().st_size / BYTES_PER_GB, 2),
                    }
                )
            except OSError:
                continue
    return results


def _run_cmd(args: List[str]) -> str:
    """Run a subprocess command safely and return decoded stdout/stderr."""
    try:
        proc = subprocess.run(args, capture_output=True, timeout=10, check=False)
        raw = proc.stdout or proc.stderr or b""
        enc = "utf-16-le" if b"\x00" in raw else "utf-8"
        return raw.decode(enc, errors="replace").strip()
    except (OSError, subprocess.SubprocessError) as exc:
        return f"ERROR: {exc}"


def get_docker_and_wsl_status() -> Dict[str, Any]:
    """Query Docker CLI, Docker Compose, WSL status, and existing .wslconfig."""
    wslconfig_path = Path(os.environ.get("USERPROFILE", str(Path.home()))) / ".wslconfig"
    existing: Optional[str] = None
    if wslconfig_path.exists():
        try:
            existing = wslconfig_path.read_text(encoding="utf-8", errors="replace").strip()
        except OSError:
            existing = "ERROR: Unable to read .wslconfig"
    return {
        "docker_version": _run_cmd(["docker", "--version"]),
        "docker_compose_version": _run_cmd(["docker", "compose", "version"]),
        "wsl_status": _run_cmd(["wsl", "--status"]),
        "wsl_list": _run_cmd(["wsl", "-l", "-v"]),
        "wslconfig_path": "$USERPROFILE\\.wslconfig",
        "wslconfig_exists": wslconfig_path.exists(),
        "wslconfig_content": existing,
    }


def generate_recommendations(
    system_info: Dict[str, Any], volumes: Dict[str, Dict[str, float]]
) -> Dict[str, Any]:
    """Calculate optimal WSL2 governance settings and storage placement verdict."""
    total_ram = system_info.get("total_ram_gb", 16.0) or 16.0
    rec_memory_gb = 6 if total_ram >= 12.0 else max(4, int(round(total_ram * 0.5)))
    rec_cpus = min(4, max(2, (system_info.get("logical_cpus", 4) or 4) // 2))

    wslconfig_text = (
        f"[wsl2]\nmemory={rec_memory_gb}GB\nprocessors={rec_cpus}\n"
        "swap=2GB\nlocalhostForwarding=true\n"
    )
    WSL_REC_PATH.parent.mkdir(parents=True, exist_ok=True)
    WSL_REC_PATH.write_text(wslconfig_text, encoding="utf-8")

    c_free = volumes.get("C:", {}).get("free_gb", 0.0)
    alt = [d for d, v in volumes.items() if d != "C:" and v.get("free_gb", 0.0) > 30.0]
    if c_free >= 25.0:
        c_status = "[OK]"
        verdict = f"C: has {c_free} GB free (>= 25.0 GB threshold). Sufficient for local execution."
    else:
        c_status = "[WARN]" if c_free >= 15.0 else "[CRITICAL]"
        target = alt[0] if alt else "D:"
        verdict = (
            f"C: drive has only {c_free} GB free (< 25.0 GB threshold). "
            f"Migrate Docker Desktop disk image location to {target}\\DockerData immediately."
        )
    rel_wsl_path = "infra/wsl/.wslconfig.recommended"
    return {
        "recommended_memory_gb": rec_memory_gb,
        "recommended_processors": rec_cpus,
        "recommended_swap_gb": 2,
        "recommended_wslconfig_path": rel_wsl_path,
        "c_drive_status": c_status,
        "disk_verdict": verdict,
        "alternate_drives_available": alt,
        "apply_wslconfig_command": (
            f'Copy-Item -Path "{rel_wsl_path}" -Destination "$env:USERPROFILE\\.wslconfig" -Force; wsl --shutdown'
        ),
    }


def _print_report(report: Dict[str, Any]) -> None:
    """Format and print ASCII engineering report to standard output."""
    s, r, dw = report["system"], report["recommendations"], report["docker_wsl"]
    print("=" * 72)
    print("DATAPULSE STEP-0 PRE-FLIGHT HARDWARE, DISK & WSL2 AUDIT")
    print("=" * 72)
    print(f"[INFO] OS Platform      : {s['os']}")
    print(f"[INFO] Logical CPUs     : {s['logical_cpus']}")
    print(f"[INFO] Physical RAM     : {s['total_ram_gb']} GB Total / {s['available_ram_gb']} GB Free")
    for drv, st in report["volumes"].items():
        tag = r["c_drive_status"] if drv == "C:" else "[INFO]"
        print(f"  {tag} Drive {drv} -> Total: {st['total_gb']} GB | Free: {st['free_gb']} GB")
    print(f"  [INFO] Docker CLI       : {dw['docker_version']}")
    print(f"  [INFO] .wslconfig Exists: {dw['wslconfig_exists']} ({dw['wslconfig_path']})")
    print(f"  {r['c_drive_status']} {r['disk_verdict']}")
    print("=" * 72)


def run_audit() -> Dict[str, Any]:
    """Execute full hardware, disk, and WSL2 audit, persist JSON, and print report."""
    sys_info = get_system_resources()
    volumes = get_disk_volumes()
    report: Dict[str, Any] = {
        "system": sys_info,
        "volumes": volumes,
        "docker_vhdx_files": find_docker_vhdx_files(),
        "docker_wsl": get_docker_and_wsl_status(),
        "recommendations": generate_recommendations(sys_info, volumes),
    }
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
    _print_report(report)
    return report


if __name__ == "__main__":
    run_audit()
