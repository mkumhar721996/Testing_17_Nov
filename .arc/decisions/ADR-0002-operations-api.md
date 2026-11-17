---
id: ADR-0002
category: component
title: Operations API
status: accepted
superseded_by: null
component_id: comp_operations_api
responsibility: 'Single API: authentication and role-based access control, record
  CRUD and search, dashboard metrics, reporting queries, notification preferences,
  audit log writes.'
kind: api_service
split_reason: Server runtime serving the web client; one API to start
talks_to:
- component_id: comp_relational_database
  interaction: shared-storage
  evidence: 'human: data management, audit logs'
- component_id: comp_identity_provider
  interaction: sync
  evidence: 'human: Managed identity provider (SaaS)'
rule: All business reads and writes, authorization checks and audit entries go through
  the Operations API.
evidence: 'human: authentication/RBAC, data management, dashboard, reporting, audit
  logs'
---

## Context

human: authentication/RBAC, data management, dashboard, reporting, audit logs

## Decision

Single API: authentication and role-based access control, record CRUD and search, dashboard metrics, reporting queries, notification preferences, audit log writes.

Kept separate because Server runtime serving the web client; one API to start.

## Talks to

- **Relational Database** (shared-storage) — human: data management, audit logs
- **Identity Provider** (sync) — human: Managed identity provider (SaaS)
