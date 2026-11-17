---
id: ADR-0007
category: nfr
title: "NFR: Availability \u2014 >= 99.5%"
status: accepted
superseded_by: null
dimension: Availability
metric: uptime during business hours
threshold: '>= 99.5%'
component_id: null
needs_dedicated_tracking: true
rule: The system is available at least 99.5% of business hours (proposed 08:00-18:00
  local, Mon-Fri); maintenance happens outside them.
evidence: 'human: business-hours uptime; 99.5% during business hours proposed from
  that wording'
---

## Context

human: business-hours uptime; 99.5% during business hours proposed from that wording

## Decision

uptime during business hours: >= 99.5%
