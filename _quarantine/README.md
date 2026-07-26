# Quarantine (Phase 0)

Moved out of active development during Phase 0 triage (`docs/ssd/IMPLEMENTATION_PLAN.md`).

**Do not** re-add these to `docker-compose.yml` or npm workspaces without an explicit product decision.
Git history preserves the pre-move paths if something needs restoring.

## Services
| Path | Reason |
|------|--------|
| `services/*-runtime` | Parallel unwired experiments; not in compose; not Domain 2 core |
| `services/billing-service` | Stripe always-200 stub — banned by SDD until real verification |
| `services/approval-service` | Broken / HITL not in Domain 2 Phase 0–2 scope |
| `services/event-processor` | Duplicate / incomplete; not in compose |

## Workers
| Path | Reason |
|------|--------|
| `workers/rpa-agent` | Out of Domain 2 core scope |
| `workers/embedding-worker` | Mock embeddings only |
| `workers/reporting-worker` | Fake PDF stub |
| `workers/sync-worker` | Random metrics stub |
| `workers/event-processor` | Incomplete; not in compose |

## Kernel (SSO/SCIM mocks)
| Path | Reason |
|------|--------|
| `kernel/identity/sso-adapter.js` | Mock SSO |
| `kernel/identity/saml-strategy.js` | Mock SAML |
| `kernel/identity/scim-provisioning.js` | Mock SCIM (accepts any bearer) |

## Explicitly not quarantined this session
- `apps/admin-dashboard` — frontend-freeze; separate later work
- `apps/client-dashboard` — frontend-freeze; Lovable UI will replace/wire later
- `ai call center/` — reference/fallback until orchestrator parity (see `PLAN.md`)
