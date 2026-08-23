# R-06 — Receta design capability / issue #350

Status: ACTIVE P0 REPAIR DIRECTIVE
Parent board: #296

## Problem
`GET /api/receta/diseno?path=` reaches Firebase Storage through Admin SDK. The current signed-token helper authenticates `path|exp`; it does not bind the capability to canonical owner/clinic identity. A path is never authorization.

## Required repair
1. Mint a design capability only after Firebase authentication plus canonical clinic membership/tenant verification. Caller-provided clinic/path identity is not authoritative.
2. Use a versioned HMAC capability binding at minimum `version + path + ownerUid + clinicId + exp`; tampering with any field fails closed and signature comparison remains constant-time.
3. For legacy `receta-diseno/{uid}/...`, the path owner must equal the authenticated/minted owner. Do not guess ownership for opaque/new namespaces.
4. Before any Admin SDK download, require and verify the bound capability. Plain `path` must not be authorization.
5. Do not silently retain unsigned access in production-equivalent behavior. Any temporary legacy compatibility must be explicit, bounded and tested; missing required secret/binding fails closed.
6. Do not assume an `<img>` request carries `Authorization`: the authenticated application first mints a short-lived scoped URL; the image request then presents only that bound expiring capability.

## Mandatory tests
- same-clinic authenticated owner can mint/use a capability;
- unauthenticated mint fails;
- clinic A cannot mint/use clinic B capability;
- owner A cannot use owner B legacy path;
- tampered path/ownerUid/clinicId/exp/signature fails;
- expired/stale capability fails;
- missing secret fails closed in production-equivalent mode;
- plain unsigned `?path=` cannot reach Admin SDK in strict/production-equivalent mode;
- valid prescription design rendering remains compatible through the mint flow;
- no clinical-photo namespace/lifecycle changes here; R-05 belongs to #353.

## Ownership / exclusions
Narrowly required `src/app/api/receta/diseno/**`, authenticated mint route if needed, `src/lib/receta-diseno-token.ts`, existing image/config integration only if strictly required, and focused tests. Reuse `verificarUsuario`, canonical membership/authz and existing server primitives. Do not touch Voice, Reasoning, Migration/R-05, Hospital/UCI, workflows, dependencies, Firebase rules, production config or clinical policy. No PHI, secrets, deploy, destructive migration or gate weakening.

Persist one exact-SHA checkpoint, run focused verification and canonical CI, then stop. No paid Codex audit is authorized for this lane by this directive.

---

## Implementation record (checkpoint on `product/receta-diseno-security-350`)

### Capability format — `src/lib/receta-diseno-token.ts`

```
sig = HMAC-SHA256( secret, JSON[ version, path, ownerUid, clinicId, exp ] )
URL = /api/receta/diseno?path=…&v=v2&own=<ownerUid>&cid=<clinicId>&exp=<epoch-s>&sig=<hex>
```

- `version` is `v2` and is **inside** the HMAC, not only in the URL. `v1`
  (`path|exp`) is no longer verifiable: an old-format token resolves to
  `version_desconocida`, never to a permissive fallback.
- The signed message is JSON, not a `|`-joined string: the bucket path admits
  arbitrary characters, so a flat separator could let two different tuples
  collapse to the same message.
- Comparison stays constant-time (`timingSafeEqual`) over equal-length buffers;
  non-hex or truncated signatures are rejected before comparison, never thrown.
- TTL dropped from **24 h to 15 min**. Affordable because the whole circuit
  re-mints on demand (see client change below).

### Fail-closed matrix

| Situation | Result |
|---|---|
| valid bound capability | download proceeds |
| no capability at all (`?path=` bare) | `403` — unless `RECETA_DISENO_COMPAT_SIN_FIRMA=1` **and** not production-equivalent |
| tampered `path` / `own` / `cid` / `exp` / `sig` | `403 invalida` — never degrades to "no capability" |
| unknown/old version | `403 version_desconocida` |
| expired | `403 vencida` |
| secret missing (server) | `403 sin_secreto` on verify, `503` on mint — never an unsigned URL |
| signed capability whose `own` ≠ owner segment of the legacy path | `403 dueno_no_coincide` (defence in depth) |
| path outside `receta-diseno/`, traversal, or no derivable owner | `403` before any Admin SDK call; never minted |
| legacy `?u=` branch | `403` by default (cannot be bound to owner/clinic) |

`esProduccionEquivalente()` is `NODE_ENV === 'production' || VERCEL_ENV set`, so
the compatibility escape hatch is dead on every Vercel environment including
previews.

### Minting — `POST /api/receta/diseno-url`

Authenticated (`verificarUsuario`) → canonical clinic resolved from
`clinic_members/{uid}` (never from the request body) → owner of the path must be
the caller or a member of the **same** clinic → capability bound to
`(path, ownerUid, callerClinicId, exp)`.

No membership ⇒ `403`. Membership read failure ⇒ `503`. Missing secret ⇒ `503`.
In no case does the route return a bare, unsigned URL any more — that was the
silent pass-through the previous version had.

### Client compatibility — the prescription still prints

`src/lib/receta-diseno-client.ts` now re-mints not only images with **no**
capability but also images whose capability is **within 2 min of expiry**. The
old predicate ("does the src contain `sig=`?") treated a stale capability as
good forever, which a 15-minute TTL would have turned into a blank letterhead at
print time. Preview (`FirmadorDisenos`), print (`print-element`) and PDF
(`pdf-download`) all go through this one helper.

### Client re-mint is now under test — `src/__tests__/receta-diseno-client.test.ts`

The server side was covered from both ends (`receta-diseno-token.test.ts`,
`receta-diseno-ruta.test.ts`), but the client helper that keeps the prescription
rendering once unsigned access is closed had no test. That helper is the point
where the mandatory criterion *"valid prescription design rendering remains
compatible through the mint flow"* actually lands on the printed page, so it is
now covered:

- an image with **no** capability is re-minted, and the path sent to the minter
  is the bucket path (not the screen URL);
- an image whose capability is **within the re-mint margin** is re-minted — the
  regression the old `sig=`-presence predicate would let through, and the one a
  15-minute TTL turns into a blank letterhead at print time;
- an expired capability is re-minted; a **fresh** one is not (no extra request);
- the legacy `?u=` form is translated to the mintable bucket path;
- fail-safe on every failure mode — network error, `401`, a server that
  **refuses** to mint (cross-clinic), or a returned URL without `sig=`: the
  `<img>` keeps its original `src` and the rest of the document still prints;
  the client never fabricates a capability;
- duplicate paths are requested once; non-proxy images are untouched.

No jsdom in this suite, so `HTMLImageElement` is doubled and `window` stubbed;
the capability URLs are built with the **real** minter so client and server
cannot drift apart in URL shape without this test noticing.

### Known consequence, accepted and out of this slice's scope

`src/lib/receta-word.ts` writes an **absolute unsigned** proxy URL for the small
letterhead into the `.doc`. That file is opened later from disk, so no expiring
capability can survive there; the letterhead image will not render inside Word
once unsigned access is closed. The fix is to inline the letterhead as a data
URI in the Word export, which is a separate change to a separate module and is
not required by this directive. The full-page design path (print / PDF) is
unaffected. Flagged for the board rather than silently bundled here.

### Not touched

Voice/ASR, reasoning, clinical policy, R-05 clinical-media namespace (#353),
Hospital/UCI, workflows, dependencies, Firebase/Storage rules, deployment or
production configuration. `docs/audit/regression-ledger.md` REG-021 records this
exact residual ("proxy sin firma hasta `RECETA_DISENO_FIRMA=obligatoria`") and
should be moved to CLOSED, but `docs/audit/**` is outside this lane's allowed
mutation areas, so the ledger update is left to the owner.
