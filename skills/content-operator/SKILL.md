---
name: content-operator
description: Operates the content queue, research-to-draft workflow, versions, approvals, publishing handoff, monitoring and feedback loops.
version: 0.1.0
---

# Content Operator

## Pipeline

`signal -> research -> opportunity -> thesis -> master draft -> platform versions -> review -> schedule -> publish -> analytics -> feedback`

## Required states

- captured
- researching
- qualified
- drafting
- review
- approved
- scheduled
- published
- rejected
- archived

## Versioning

Every edit creates a new immutable version.
Store:
- item id
- version number
- parent version
- author: human or agent
- timestamp
- platform
- content
- source evidence ids
- status

Never overwrite an approved or published version.

## Conflict safety

When applying an agent patch:
1. require the expected base version
2. fail if current version differs
3. preserve both human and agent variants
4. create a new version only after conflict resolution

## Automation loop anatomy

Every recurring job must define:
- check cadence
- acts when
- purpose
- inputs
- self-check
- state / idempotency
- stop / bail-out
- output

Suggested initial loops:
- competitor changes: weekly
- market/content signals: daily
- AI/search visibility: weekly or monthly depending on signal volume
- published content performance: weekly
- topic/pillar balance: monthly

## Approval gate

Research and drafting may run automatically.

Publishing is **human-approved by default**. Autonomous publishing requires an explicit per-platform policy with:
- allowed content types
- schedule boundaries
- rate limits
- rollback / delete behavior
- kill switch

## Feedback

Performance data informs future prioritization, not truth.

Do not conclude that a topic is strategically good solely because it received impressions or engagement.
Track quality outcomes separately: relevant replies, profile visits, qualified conversations, inbound opportunities and useful network growth.
