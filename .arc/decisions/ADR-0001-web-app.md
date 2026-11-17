---
id: ADR-0001
category: component
title: Web App
status: accepted
superseded_by: null
component_id: comp_web_app
responsibility: 'Browser UI for administrators, business users, managers and support:
  login, dashboard of key metrics, record management and search, reports, notifications.'
kind: web_ui
split_reason: Browser client runtime, distinct from server components
talks_to:
- component_id: comp_operations_api
  interaction: sync
  evidence: 'human: web app with dashboard and record management'
- component_id: comp_identity_provider
  interaction: sync
  evidence: 'human: Managed identity provider (SaaS)'
rule: The Web App reaches data only through the API.
evidence: 'human: web-based application with centralized dashboard'
---

## Context

human: web-based application with centralized dashboard

## Decision

Browser UI for administrators, business users, managers and support: login, dashboard of key metrics, record management and search, reports, notifications.

Kept separate because Browser client runtime, distinct from server components.

## Talks to

- **Operations API** (sync) — human: web app with dashboard and record management
- **Identity Provider** (sync) — human: Managed identity provider (SaaS)
