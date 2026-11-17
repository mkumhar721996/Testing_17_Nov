---
id: ADR-0003
category: component
title: Background Worker
status: accepted
superseded_by: null
component_id: comp_background_worker
responsibility: 'Runs asynchronous jobs: report generation, notification and alert
  delivery.'
kind: worker
split_reason: Background jobs for reports and notifications; one worker for all jobs
talks_to:
- component_id: comp_relational_database
  interaction: shared-storage
  evidence: 'human: reporting, notifications'
rule: Long-running or deferred work runs in the Background Worker, never in API request
  handlers.
evidence: 'human: reporting and analytics, notifications and alerts'
---

## Context

human: reporting and analytics, notifications and alerts

## Decision

Runs asynchronous jobs: report generation, notification and alert delivery.

Kept separate because Background jobs for reports and notifications; one worker for all jobs.

## Talks to

- **Relational Database** (shared-storage) — human: reporting, notifications
