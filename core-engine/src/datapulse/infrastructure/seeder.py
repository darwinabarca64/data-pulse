"""Deterministic 10,000-record financial seeder with controlled 2% anomaly injection."""

import math
import random
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

import duckdb

COUNTRIES = ("US", "ES", "GB", "DE", "MX")
CURRENCIES = ("USD", "EUR", "GBP")
TIERS = ("SME", "MID_MARKET", "ENTERPRISE", "ENTERPRISE_VIP")
BASE_TIMESTAMP = datetime(2026, 10, 29, 0, 0, 0, tzinfo=timezone.utc)


def _format_csv_float(val: float) -> str:
    """Format a float for DuckDB CSV ingestion, preserving IEEE-754 NaN."""
    if math.isnan(val):
        return "nan"
    return f"{val:.4f}"


def ensure_source_table(conn: duckdb.DuckDBPyConnection) -> None:
    """Create schema marts and table fct_customer_profitability if not present."""
    conn.execute("CREATE SCHEMA IF NOT EXISTS marts;")
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS marts.fct_customer_profitability (
            customer_id VARCHAR NOT NULL PRIMARY KEY,
            email VARCHAR NOT NULL,
            company_name VARCHAR NOT NULL,
            country_code VARCHAR NOT NULL,
            currency_code VARCHAR NOT NULL,
            annual_revenue DOUBLE NOT NULL,
            annual_cost DOUBLE NOT NULL,
            net_profitability_usd DOUBLE NOT NULL,
            profit_margin_pct DOUBLE NOT NULL,
            customer_tier VARCHAR NOT NULL,
            updated_at TIMESTAMP NOT NULL
        );
        """
    )


def seed_duckdb_warehouse(
    conn: duckdb.DuckDBPyConnection, total_rows: int = 10000
) -> dict[str, int]:
    """Idempotently seed DuckDB with 98% valid records, 1.5% bad emails, and 0.5% NaNs."""
    ensure_source_table(conn)

    clean_count = int(total_rows * 0.98)
    email_poison_count = int(total_rows * 0.015)
    nan_poison_count = total_rows - clean_count - email_poison_count
    vip_drop_target = min(60, clean_count)

    existing_row = conn.execute(
        "SELECT COUNT(*) FROM marts.fct_customer_profitability;"
    ).fetchone()
    existing_count = int(existing_row[0]) if existing_row else 0
    if existing_count >= total_rows:
        return {
            "total_rows": existing_count,
            "clean_rows": clean_count,
            "poison_email_rows": email_poison_count,
            "poison_nan_rows": nan_poison_count,
            "vip_margin_drop_rows": vip_drop_target,
        }

    rng = random.Random(42)
    csv_lines: list[str] = []
    vip_drop_count = 0

    for idx in range(1, total_rows + 1):
        customer_id = f"CUST-{idx:05d}"
        company_name = f"Corp Alpha Holdings {idx}"
        country = COUNTRIES[idx % len(COUNTRIES)]
        currency = CURRENCIES[idx % len(CURRENCIES)]
        updated_str = (BASE_TIMESTAMP + timedelta(seconds=idx)).strftime(
            "%Y-%m-%d %H:%M:%S"
        )

        if idx <= clean_count:
            email = f"finance.contact.{idx}@corp-alpha-{idx}.com"
            if idx <= vip_drop_target:
                tier = "ENTERPRISE_VIP"
                revenue, cost, net_profit, margin_pct = 400000.0, 480000.0, -80000.0, -20.0
                vip_drop_count += 1
            else:
                tier = TIERS[idx % len(TIERS)]
                revenue = round(25000.0 * rng.paretovariate(1.8), 2)
                cost = round(revenue * rng.uniform(0.45, 1.15), 2)
                net_profit = round(revenue - cost, 2)
                margin_pct = round((net_profit / revenue) * 100.0, 2)
                if tier == "ENTERPRISE_VIP" and margin_pct < -12.0:
                    vip_drop_count += 1
        elif idx <= clean_count + email_poison_count:
            email = "corrupt@@domain..com" if idx % 2 == 0 else "missing-at-symbol.org"
            tier = "MID_MARKET"
            revenue, cost, net_profit, margin_pct = 120000.0, 90000.0, 30000.0, 25.0
        else:
            email = f"finance.contact.{idx}@corp-alpha-{idx}.com"
            tier = "SME"
            revenue, cost, net_profit, margin_pct = 0.0, 0.0, 0.0, float("nan")

        csv_lines.append(
            f"{customer_id},{email},{company_name},{country},{currency},"
            f"{_format_csv_float(revenue)},{_format_csv_float(cost)},"
            f"{_format_csv_float(net_profit)},{_format_csv_float(margin_pct)},"
            f"{tier},{updated_str}"
        )

    with tempfile.NamedTemporaryFile(
        mode="w", encoding="utf-8", suffix=".csv", delete=False
    ) as tmp_csv:
        tmp_path = Path(tmp_csv.name)
        tmp_csv.write("\n".join(csv_lines))

    try:
        posix_csv = tmp_path.as_posix()
        conn.execute(
            f"COPY marts.fct_customer_profitability FROM '{posix_csv}' (HEADER FALSE);"
        )
    finally:
        tmp_path.unlink(missing_ok=True)

    return {
        "total_rows": total_rows,
        "clean_rows": clean_count,
        "poison_email_rows": email_poison_count,
        "poison_nan_rows": nan_poison_count,
        "vip_margin_drop_rows": vip_drop_count,
    }
