# Consultorio Scale Evidence Contract

Parent: #310. Canonical board: #296.

This contract is intentionally independent of active Voice/Reasoning product writers. It defines machine-readable evidence only; it does not claim production capacity, set an SLO, modify clinical behavior, create spend, or deploy anything.

## Purpose

Every Consultorio load/resilience run must produce evidence tied to one exact candidate SHA. The evidence is valid only when it is synthetic/non-PHI and distinguishes registered physician count from concurrent active consultations.

The validator is:

```bash
node scripts/product/validate-consultorio-load-result.mjs result.json
```

A successful validator exit means the evidence shape is internally consistent. It does **not** mean the candidate supports 2k, 10k, or any other physician count. Capacity/SLO PASS requires separately approved thresholds derived from measured baseline evidence.

## Required evidence

```json
{
  "syntheticNonPhi": true,
  "candidateSha": "0123456789abcdef0123456789abcdef01234567",
  "environment": "non-production-load-harness",
  "scenario": "multi-tenant-2k",
  "seed": "consultorio-001",
  "registeredPhysicians": 2000,
  "concurrentConsultations": 200,
  "requestCount": 10000,
  "successCount": 9995,
  "errorCount": 5,
  "latencyMs": { "p50": 120, "p95": 310, "p99": 620 },
  "durableSavePassed": true,
  "recoveryPassed": true,
  "lostDraftCount": 0,
  "blankScreenCount": 0,
  "crossTenantLeakageCount": 0,
  "unboundedReadCount": 0,
  "idempotencyViolationCount": 0,
  "silentProviderFailureCount": 0,
  "queues": {
    "transcription": { "maxDepth": 20, "retryCount": 1, "duplicateCount": 0 },
    "reasoning": { "maxDepth": 12, "retryCount": 0, "duplicateCount": 0 },
    "evidence": { "maxDepth": 8, "retryCount": 0, "duplicateCount": 0 },
    "document": { "maxDepth": 6, "retryCount": 0, "duplicateCount": 0 }
  },
  "providerUsage": [
    { "providerClass": "synthetic-stub", "invocationCount": 400, "testCost": 0 }
  ]
}
```

## Unconditional launch blockers

The validator surfaces these independently of aggregate latency:

- lost draft;
- blank/white screen on the consultation hot path;
- cross-tenant leakage;
- unbounded collection read;
- non-idempotent duplicate;
- silent provider failure that contaminates or blocks the consultation path.

Any count above zero is evidence of a launch-critical defect for the affected candidate slice. The validator reports it but does not alter code or auto-approve a release.

## Backpressure

Queue depth and retry/duplicate counts are recorded separately for transcription, reasoning, evidence, and document generation. Secondary work is allowed to lag under burst; encounter open/edit/save/resume must remain usable and durable. The future harness should measure the interactive path separately from asynchronous completion.

## Privacy boundary

Evidence output must contain no PHI. The validator requires `syntheticNonPhi: true` and rejects obvious patient-identifying field names. Fixtures must remain synthetic and deterministic. Logs and evidence must use opaque synthetic identifiers only.

## Gate semantics

The validator deliberately emits `capacityPassDeclared: false`. This prevents a structurally valid result from being mistaken for a 2k/10k capacity claim. SAFE_TO_DEPLOY may consume this artifact only together with candidate-specific thresholds, CI/golden-path evidence, restore/migration evidence, and all other launch gates on #296.
