---
id: ADR-0004
category: component
title: Relational Database
status: accepted
superseded_by: null
component_id: comp_relational_database
responsibility: System of record for users, roles, records, notifications and audit
  logs; product not yet chosen.
kind: infrastructure
split_reason: Backing service the project uses but doesn't build
rule: Only the Operations API and Background Worker access the database; audit logs
  are append-only.
evidence: 'human: data management, audit logs and activity tracking'
---

## Context

human: data management, audit logs and activity tracking

## Decision

System of record for users, roles, records, notifications and audit logs; product not yet chosen.

Kept separate because Backing service the project uses but doesn't build.
