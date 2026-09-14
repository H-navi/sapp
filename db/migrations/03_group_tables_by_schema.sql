-- =====================================================================
-- Migration: 03_group_tables_by_schema.sql
-- Description: Group 36 tables from public schema into modular schemas
-- Schemas: auth, org, leaves, approvals, notifications, system
-- Target: PostgreSQL 16+
-- =====================================================================

BEGIN;

-- 1. Create schemas
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS org;
CREATE SCHEMA IF NOT EXISTS leaves;
CREATE SCHEMA IF NOT EXISTS approvals;
CREATE SCHEMA IF NOT EXISTS notifications;
CREATE SCHEMA IF NOT EXISTS system;

-- 2. Move tables to 'auth' schema
ALTER TABLE public.users SET SCHEMA auth;
ALTER TABLE public.roles SET SCHEMA auth;
ALTER TABLE public.permissions SET SCHEMA auth;
ALTER TABLE public.role_permissions SET SCHEMA auth;
ALTER TABLE public.user_roles SET SCHEMA auth;
ALTER TABLE public.user_sessions SET SCHEMA auth;
ALTER TABLE public.password_reset_tokens SET SCHEMA auth;

-- 3. Move tables to 'org' schema
ALTER TABLE public.departments SET SCHEMA org;
ALTER TABLE public.positions SET SCHEMA org;
ALTER TABLE public.employees SET SCHEMA org;

-- 4. Move tables to 'leaves' schema
ALTER TABLE public.leave_types SET SCHEMA leaves;
ALTER TABLE public.leave_type_eligibilities SET SCHEMA leaves;
ALTER TABLE public.leave_policies SET SCHEMA leaves;
ALTER TABLE public.leave_policy_rules SET SCHEMA leaves;
ALTER TABLE public.leave_quotas SET SCHEMA leaves;
ALTER TABLE public.leave_quota_ledger SET SCHEMA leaves;

-- 5. Move tables to 'approvals' schema
ALTER TABLE public.approval_workflows SET SCHEMA approvals;
ALTER TABLE public.approval_workflow_steps SET SCHEMA approvals;
ALTER TABLE public.approval_delegations SET SCHEMA approvals;
ALTER TABLE public.leave_requests SET SCHEMA approvals;
ALTER TABLE public.leave_request_days SET SCHEMA approvals;
ALTER TABLE public.leave_request_attachments SET SCHEMA approvals;
ALTER TABLE public.leave_request_rule_checks SET SCHEMA approvals;
ALTER TABLE public.approval_tasks SET SCHEMA approvals;
ALTER TABLE public.approval_task_assignees SET SCHEMA approvals;
ALTER TABLE public.approval_histories SET SCHEMA approvals;

-- 6. Move tables to 'notifications' schema
ALTER TABLE public.notification_templates SET SCHEMA notifications;
ALTER TABLE public.notification_template_variables SET SCHEMA notifications;
ALTER TABLE public.notification_preferences SET SCHEMA notifications;
ALTER TABLE public.notifications SET SCHEMA notifications;
ALTER TABLE public.in_app_notifications SET SCHEMA notifications;

-- 7. Move tables to 'system' schema
ALTER TABLE public.working_hours SET SCHEMA system;
ALTER TABLE public.holidays SET SCHEMA system;
ALTER TABLE public.system_settings SET SCHEMA system;
ALTER TABLE public.audit_logs SET SCHEMA system;
ALTER TABLE public.job_executions SET SCHEMA system;

-- 8. Configure default search_path on database and role
ALTER DATABASE sapp SET search_path TO auth, org, leaves, approvals, notifications, system, public;
ALTER ROLE sapp SET search_path TO auth, org, leaves, approvals, notifications, system, public;

COMMIT;
