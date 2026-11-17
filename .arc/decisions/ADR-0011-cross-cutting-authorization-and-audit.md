---
id: ADR-0011
category: cross_cutting
title: 'Cross-cutting: Authorization and audit'
status: accepted
superseded_by: null
component_id: null
rule: Every API request is authorized against the caller's role, and every state change
  is written to the audit log.
decision: Role-based access (Administrator, Business User, Manager/Supervisor, Support)
  enforced in the API on every request; every create, update, delete and login is
  recorded in an audit log.
evidence: 'human: role-based access control; audit logs and activity tracking'
---

## Context

human: role-based access control; audit logs and activity tracking

## Decision

Role-based access (Administrator, Business User, Manager/Supervisor, Support) enforced in the API on every request; every create, update, delete and login is recorded in an audit log.
