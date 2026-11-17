---
id: ADR-0005
category: component
title: Identity Provider
status: accepted
superseded_by: null
component_id: comp_identity_provider
responsibility: 'Managed SaaS identity provider: user sign-in, credentials, tokens;
  runs on Amazon Cognito.'
kind: managed_service
split_reason: Backing service the project uses but doesn't build
rule: Credentials are held only by the Identity Provider; the API validates its tokens
  and maps users to roles.
evidence: 'human: Amazon Cognito'
---

## Context

human: Amazon Cognito

## Decision

Managed SaaS identity provider: user sign-in, credentials, tokens; runs on Amazon Cognito.

Kept separate because Backing service the project uses but doesn't build.
