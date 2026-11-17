---
id: ADR-0013
category: cross_cutting
title: 'Cross-cutting: Tenant isolation'
status: accepted
superseded_by: null
component_id: null
rule: Every tenant-owned table has a tenant_id, and every query, background job and
  audit entry is scoped to the caller's tenant.
decision: 'Multi-tenant with shared tables: every tenant-owned row carries a tenant
  ID, set from the authenticated user''s token and applied to every query, job and
  audit entry.'
evidence: 'human: Multi-tenant, shared tables'
contested: true
alternatives_considered:
- 'Database per tenant: heavier to operate and unnecessary at under 500 users.'
- 'Single organization: the human stated several tenants.'
consequences:
- Tenant scoping bugs are cross-tenant data leaks, so scoping must be enforced centrally
  in the API's data layer.
- The identity provider must carry a tenant claim in tokens.
---

## Context

human: Multi-tenant, shared tables

## Decision

Multi-tenant with shared tables: every tenant-owned row carries a tenant ID, set from the authenticated user's token and applied to every query, job and audit entry.

## Alternatives considered

- Database per tenant: heavier to operate and unnecessary at under 500 users.
- Single organization: the human stated several tenants.

## Consequences

- Tenant scoping bugs are cross-tenant data leaks, so scoping must be enforced centrally in the API's data layer.
- The identity provider must carry a tenant claim in tokens.
