# Runbook 00: Host Hardware, Disk Volume, and WSL2 Resource Governance Setup

## Overview
Before initializing the `data-pulse` container stack (Apache Airflow, PostgreSQL, DuckDB Python Engine, and TypeScript Connectors), engineers must verify host physical RAM, CPU core allocation, and disk capacity across local volumes. Unbounded WSL2 virtual machines (`vmmem`) and expanding Docker `ext4.vhdx` virtual disks on `C:` are the primary causes of local workstation instability.

---

## 1. Execute the Pre-Flight Hardware Audit

Run the zero-dependency standard library diagnostic script from the repository root:

```powershell
python scripts/preflight_hardware_audit.py
```

### Outputs Produced
1. **Console Engineering Report**: Displays physical RAM, logical CPU cores, free disk capacity across `C:`, `D:`, `E:`, `F:`, existing Docker `.vhdx` sizes, and WSL2 readiness.
2. **Structured JSON Artifact**: Writes full telemetry to `docs/runbooks/hardware_audit_report.json`.
3. **Recommended WSL2 Configuration**: Generates `infra/wsl/.wslconfig.recommended` tailored to the host's hardware profile.

---

## 2. Relocating Docker Desktop Virtual Disk (`ext4.vhdx`) Off `C:` Drive

If the pre-flight audit reports `[WARN]` or `[CRITICAL]` for `C:` drive capacity (< 25.0 GB free), or if existing `%LOCALAPPDATA%\Docker\wsl` `.vhdx` files are consuming critical system space, relocate Docker Desktop's disk image to a secondary volume (`D:` or `E:`):

### Step-by-Step Procedure (Windows 10 / Docker Desktop)
1. Create a dedicated target directory on a secondary drive with ample free space (for example, `D:\DockerData` or `E:\DockerData`):
   ```powershell
   New-Item -ItemType Directory -Force -Path "D:\DockerData"
   ```
2. Open **Docker Desktop**.
3. Navigate to **Settings** (gear icon) -> **Resources** -> **Advanced** (or **Disk**).
4. Locate the **Disk image location** setting (default is `C:\Users\<User>\AppData\Local\Docker\wsl\data`).
5. Click **Browse** and select `D:\DockerData` (or `E:\DockerData`).
6. Click **Apply & restart**. Docker Desktop will safely stop active containers, migrate the `ext4.vhdx` virtual disk to the new drive, and reclaim space on `C:`.

---

## 3. Applying `.wslconfig` Resource Governance Limits

To prevent WSL2 (`vmmem`) from claiming unbounded host RAM during Airflow scheduling and DuckDB analytical queries, apply the generated `.wslconfig.recommended` file to your Windows user profile.

### Step-by-Step Procedure
1. Copy the generated configuration file to `%USERPROFILE%\.wslconfig`:
   ```powershell
   Copy-Item -Path "infra\wsl\.wslconfig.recommended" -Destination "$env:USERPROFILE\.wslconfig" -Force
   ```
2. Inspect the applied configuration to verify settings:
   ```powershell
   Get-Content "$env:USERPROFILE\.wslconfig"
   ```
   Expected structure:
   ```ini
   [wsl2]
   memory=6GB
   processors=4
   swap=2GB
   localhostForwarding=true
   ```
3. Shut down WSL2 completely so the hypervisor reloads the updated memory and processor bounds (note: WSL requires at least 8 seconds of full termination to release the VM):
   ```powershell
   wsl --shutdown
   ```
4. Restart **Docker Desktop** and re-run the pre-flight audit to confirm `.wslconfig` is active:
   ```powershell
   python scripts/preflight_hardware_audit.py
   ```

