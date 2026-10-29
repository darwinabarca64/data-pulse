-- ============================================================================
-- DATAPULSE STEP 1: SNOWFLAKE FINOPS GUARDRAILS & COST GOVERNANCE
-- Script: infra/snowflake/00_finops_guardrails.sql
-- Purpose: Provision bounded compute warehouse, query timeouts, hard credit
--          resource monitors, and privilege locks against warehouse resizing.
-- ============================================================================

USE ROLE ACCOUNTADMIN;

-- ----------------------------------------------------------------------------
-- 1. PROVISION BOUNDED SERVICE WAREHOUSE (X-SMALL + 60s AUTO-SUSPEND)
-- ----------------------------------------------------------------------------
CREATE WAREHOUSE IF NOT EXISTS WH_DATA_PULSE_XS
    WAREHOUSE_SIZE = 'XSMALL'
    WAREHOUSE_TYPE = 'STANDARD'
    AUTO_SUSPEND = 60
    AUTO_RESUME = TRUE
    INITIALLY_SUSPENDED = TRUE
    MIN_CLUSTER_COUNT = 1
    MAX_CLUSTER_COUNT = 1
    SCALING_POLICY = 'ECONOMY'
    COMMENT = 'Dedicated X-Small compute warehouse for DataPulse Reverse ETL syncs';

-- ----------------------------------------------------------------------------
-- 2. GUARDRAIL 1: QUERY EXECUTION & QUEUE TIMEOUTS
-- Prevents runaway analytical queries or Cartesian joins from burning credits.
-- ----------------------------------------------------------------------------
ALTER WAREHOUSE WH_DATA_PULSE_XS SET
    STATEMENT_TIMEOUT_IN_SECONDS = 300
    STATEMENT_QUEUED_TIMEOUT_IN_SECONDS = 120;

-- ----------------------------------------------------------------------------
-- 3. GUARDRAIL 2: HARD MONTHLY BUDGET CUTOFF (RESOURCE MONITOR)
-- Enforces notification at 75%, graceful suspend at 95%, and immediate kill
-- at 100% of the 50-credit monthly quota.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE RESOURCE MONITOR RM_DATA_PULSE_MONTHLY_GUARD
    WITH CREDIT_QUOTA = 50
    FREQUENCY = MONTHLY
    START_TIMESTAMP = IMMEDIATELY
    TRIGGERS
        ON 75 PERCENT DO NOTIFY
        ON 95 PERCENT DO SUSPEND
        ON 100 PERCENT DO SUSPEND_IMMEDIATE;

ALTER WAREHOUSE WH_DATA_PULSE_XS SET
    RESOURCE_MONITOR = RM_DATA_PULSE_MONTHLY_GUARD;

-- ----------------------------------------------------------------------------
-- 4. GUARDRAIL 3: SCALE-UP LOCK (PRIVILEGE ISOLATION)
-- Ensure the automated service role can never execute ALTER WAREHOUSE ... SET
-- WAREHOUSE_SIZE = 'LARGE'. Only USAGE and OPERATE are permitted.
-- ----------------------------------------------------------------------------
CREATE ROLE IF NOT EXISTS ROLE_DATA_PULSE_SERVICE
    COMMENT = 'Zero-trust least-privilege service role for DataPulse Reverse ETL';

GRANT USAGE, OPERATE ON WAREHOUSE WH_DATA_PULSE_XS TO ROLE ROLE_DATA_PULSE_SERVICE;
REVOKE MODIFY ON WAREHOUSE WH_DATA_PULSE_XS FROM ROLE ROLE_DATA_PULSE_SERVICE;
REVOKE MONITOR ON WAREHOUSE WH_DATA_PULSE_XS FROM ROLE ROLE_DATA_PULSE_SERVICE;

