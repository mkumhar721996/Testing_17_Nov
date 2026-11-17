---
id: ADR-0008
category: deployment_target
title: "Deployment target: AWS, running as containers; prod and staging environments\
  \ in a single region\u2026"
status: accepted
superseded_by: null
component_id: null
rule: All components are built as container images and run in one AWS region, in prod
  and staging environments.
decision: AWS, running as containers; prod and staging environments in a single region
  (no residency constraint, no multi-region).
evidence: 'human: AWS, containers; compliance/residency: None'
---

## Context

human: AWS, containers; compliance/residency: None

## Decision

AWS, running as containers; prod and staging environments in a single region (no residency constraint, no multi-region).
