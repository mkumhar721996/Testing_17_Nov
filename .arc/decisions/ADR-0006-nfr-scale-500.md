---
id: ADR-0006
category: nfr
title: "NFR: Scale \u2014 <= 500"
status: accepted
superseded_by: null
dimension: Scale
metric: registered users
threshold: <= 500
component_id: null
needs_dedicated_tracking: true
rule: Design for up to 500 users; no horizontal-scaling machinery beyond a single
  small container set per component.
evidence: 'human: Under 500 users, business-hours uptime'
---

## Context

human: Under 500 users, business-hours uptime

## Decision

registered users: <= 500
