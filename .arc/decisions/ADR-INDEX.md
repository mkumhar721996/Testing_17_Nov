# ADR Index

One line per decision — the rule, not the reasoning. Read the full ADR (`.arc/decisions/ADR-NNNN-*.md`) for context and rationale.

## Accepted — binding rules

| ADR | Category | Status | Rule |
|---|---|---|---|
| ADR-0001 | component | accepted | The Web App reaches data only through the API. |
| ADR-0002 | component | accepted | All business reads and writes, authorization checks and audit entries go through the Operations API. |
| ADR-0003 | component | accepted | Long-running or deferred work runs in the Background Worker, never in API request handlers. |
| ADR-0004 | component | accepted | Only the Operations API and Background Worker access the database; audit logs are append-only. |
| ADR-0005 | component | accepted | Credentials are held only by the Identity Provider; the API validates its tokens and maps users to roles. |
| ADR-0006 | nfr | accepted | Design for up to 500 users; no horizontal-scaling machinery beyond a single small container set per component. |
| ADR-0007 | nfr | accepted | The system is available at least 99.5% of business hours (proposed 08:00-18:00 local, Mon-Fri); maintenance happens outside them. |
| ADR-0008 | deployment_target | accepted | All components are built as container images and run in one AWS region, in prod and staging environments. |
| ADR-0009 | integration_surface | accepted | Email notifications are sent only by the Background Worker through the email delivery service; product not yet chosen. |
| ADR-0010 | integration_surface | accepted | Chat alerts are posted only by the Background Worker through the chat platform's API. |
| ADR-0011 | cross_cutting | accepted | Every API request is authorized against the caller's role, and every state change is written to the audit log. |
| ADR-0012 | cross_cutting | accepted | No compliance-driven controls are required; revisit if a regime or residency requirement is introduced. |
| ADR-0013 | cross_cutting | accepted | Every tenant-owned table has a tenant_id, and every query, background job and audit entry is scoped to the caller's tenant. |
