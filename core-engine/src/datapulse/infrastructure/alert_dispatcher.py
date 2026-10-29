"""Multi-channel operational and FinOps alert dispatcher (console, discord, slack)."""

import json
import os
import sys
import urllib.error
import urllib.request
from typing import Any

from datapulse.domain.ports import AlertDispatcherPort

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

SUPPORTED_ALERT_PROVIDERS = {"console", "discord", "slack"}


class MultiChannelAlertDispatcher(AlertDispatcherPort):
    """Dispatch reconciliation and DLQ triage alerts to Console, Discord, or Slack."""

    def __init__(
        self,
        provider: str | None = None,
        discord_webhook_url: str | None = None,
        slack_webhook_url: str | None = None,
        quiet_console: bool = False,
    ) -> None:
        raw_provider = provider or os.environ.get("ALERT_PROVIDER", "console")
        self._provider = raw_provider.strip().lower()
        if self._provider not in SUPPORTED_ALERT_PROVIDERS:
            raise ValueError(
                f"[ERROR] Unsupported ALERT_PROVIDER '{self._provider}'. "
                f"Allowed: {sorted(SUPPORTED_ALERT_PROVIDERS)}"
            )
        self._discord_url = (
            discord_webhook_url
            if discord_webhook_url is not None
            else os.environ.get("DISCORD_WEBHOOK_URL", "")
        )
        self._slack_url = (
            slack_webhook_url
            if slack_webhook_url is not None
            else os.environ.get("SLACK_WEBHOOK_URL", "")
        )
        self._quiet_console = quiet_console
        self.dispatched_messages: list[str] = []

    def _post_webhook_json(self, url: str, body: dict[str, Any]) -> bool:
        """Send JSON payload to a Discord or Slack webhook URL via urllib.request."""
        if not url or "replace-token" in url:
            return False
        data = json.dumps(body).encode("utf-8")
        req = urllib.request.Request(
            url=url,
            data=data,
            headers={
                "Content-Type": "application/json; charset=utf-8",
                "User-Agent": "DataPulse-AlertDispatcher/0.1",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=5.0) as resp:
                return int(resp.status) in (200, 204)
        except (urllib.error.URLError, TimeoutError, OSError):
            return False

    def dispatch_sync_report(self, report_text: str, payload: dict[str, Any]) -> bool:
        """Route report to configured ALERT_PROVIDER with safe console fallback."""
        self.dispatched_messages.append(report_text)

        if self._provider == "discord":
            sent = self._post_webhook_json(
                self._discord_url, {"content": f"```text\n{report_text[:1900]}\n```"}
            )
            if sent:
                return True

        elif self._provider == "slack":
            sent = self._post_webhook_json(
                self._slack_url, {"text": f"```{report_text[:2900]}```"}
            )
            if sent:
                return True

        if not self._quiet_console:
            print(report_text)
        return True

