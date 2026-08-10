# NEXUSMED MASTER LOOP V15 — STRUCTURAL UI/UX RE-ARCHITECTURE

**Codename:** STRUCTURE BEFORE SKIN

**Mission:** Perform a complete structural redesign of NexusMED Practice — information architecture, application shell, layout, visual hierarchy, interaction model, component system, responsive behavior and design system — **without changing clinical/business logic for now**.

**Status:** V15 supersedes the presentation/interaction redesign portions of V10/V14 when they conflict. V7/V9/V12/V13/V14 safety, clinical truth, evidence, permissions, data-integrity and workflow semantics remain in force.

**Canonical path:** `docs/ai/NEXUSMED_MASTER_LOOP_V15_STRUCTURAL_UIUX_REARCHITECTURE.md`

**Critical principle:** A color/font/token migration is NOT a redesign.

---

# 0. WHY V15 EXISTS

The current NexusMED UI has a structural problem, not a palette problem.

A redesign FAILS if it keeps:

- the same 20+ destination sidebar;
- the same module-first information architecture;
- the same dashboard/card-grid composition;
- the same page skeleton;
- the same navigation hierarchy;
- the same interaction model;
- the same workflow fragmentation;

and merely changes:

- colors;
- fonts;
- shadows;
- border radii;
- icon style;
- spacing;
- gradients;
- brand name.

V15 exists to prevent "reskinning" from being mistaken for product design.

The required transformation is:

```text
OLD MENTAL MODEL

Agenda
Patients
EHR
Prescriptions
AI
Labs
Payments
Reports
Portal
Settings
...

        ↓

NEW NEXUSMED MENTAL MODEL

NOW
PATIENT
ENCOUNTER
CLINICAL STATE
NEXT SAFE ACTION
WHAT REMAINS OPEN
CONTINUITY
CLOSURE
```

The physician must feel that they are moving through **one continuous clinical workspace**, not opening modules.

---

# 1. FUNCTIONAL LOGIC FREEZE

V15 is primarily a presentation and interaction architecture program.

DO NOT intentionally change:

- clinical algorithms;
- medical safety rules;
- medication logic;
- evidence logic;
- Firestore schema;
- database semantics;
- authentication;
- authorization/RBAC semantics;
- billing rules;
- production Stripe behavior;
- API contracts;
- clinical calculations;
- signed-document semantics;
- audit semantics;
- backend business logic.

Allowed:

- presentation-layer adapters;
- view models;
- selectors;
- UI state;
- layout composition;
- route composition;
- navigation state preservation;
- component extraction;
- CSS/design tokens;
- responsive restructuring;
- accessibility fixes;
- keyboard/touch interaction;
- safe client-side interaction state;
- compatibility wrappers.

If a structural redesign appears to require business-logic changes:

1. record the dependency;
2. do not silently modify logic;
3. continue another structural task;
4. escalate only if truly blocking.

Every migrated screen must demonstrate **behavioral equivalence** for existing validated functions.

---

# 2. COMPETITIVE DESIGN RESEARCH — PRINCIPLES, NOT PIXELS

Research current public behavior and screenshots from:

- Abridge;
- Suki;
- Nabla;
- HuliPractice;
- relevant high-quality clinical systems;
- exceptional non-medical productivity software when useful.

Do NOT copy their trade dress.

For each competitor extract:

```text
USER JOB
→ INFORMATION ARCHITECTURE PRINCIPLE
→ LAYOUT PRINCIPLE
→ INTERACTION PRINCIPLE
→ WHAT FEELS INTENTIONAL
→ WHAT CREATES FRICTION
→ ORIGINAL NEXUSMED RESPONSE
```

The comparison must explicitly cover:

1. UI Design;
2. Interaction Design;
3. Design System;
4. Layout;
5. Information Architecture;
6. Navigation;
7. Mobile behavior;
8. State transitions;
9. Density;
10. Context preservation;
11. AI placement;
12. note/encounter workflow;
13. accessibility;
14. perceived performance.

Do not conclude "better" from aesthetics alone.

---

# 3. COMPETITIVE PRINCIPLES V15 SHOULD LEARN

## 3.1 Abridge principle

The clinician-facing flow should minimize choices around the encounter.

Useful principle:

```text
WORKLIST
→ PATIENT
→ RECORD
→ CREATE / REVIEW NOTE
```

The encounter is the center.

NexusMED must learn the focus and low decision burden — not copy Abridge visuals.

## 3.2 Suki principle

AI should support the clinical workflow rather than sit in a generic AI page.

Useful principle:

```text
PATIENT CONTEXT
→ AMBIENT DOCUMENTATION
→ NOTE
→ CODING / ORDERS / INSTRUCTIONS
```

NexusMED should place intelligence next to the work it affects.

## 3.3 Nabla principle

The encounter should have one obvious primary action and synchronize across contexts/devices.

Useful principle:

```text
CONTEXT
→ START ENCOUNTER
→ CAPTURE
→ STRUCTURED OUTPUT
→ REVIEW
```

NexusMED should learn restraint and state continuity.

## 3.4 Huli principle

Huli is a useful benchmark for Latin-American practice-management completeness:

- agenda;
- expediente;
- recetas;
- reminders;
- AI documentation;
- administrative workflows.

But V15 must NOT use traditional module-first Practice Management as its interaction north star.

Huli is a baseline for completeness and market expectations.

Abridge/Suki/Nabla are stronger references for encounter-centered interaction.

NexusMED's opportunity is to combine:

```text
LATAM PRACTICE COMPLETENESS
+
ENCOUNTER-CENTERED INTERACTION
+
LONGITUDINAL PATIENT CONTINUITY
+
CLOSED-LOOP CLINICAL WORK
```

without looking like any of them.

---

# 4. THE V15 PRODUCT MODEL

NexusMED is a **Patient Continuity Workspace**.

Primary grammar:

```text
PATIENT
→ ENCOUNTER
→ CLINICAL STATE
→ ACTION
→ FOLLOW-UP
→ CLOSURE
→ NEXT ENCOUNTER
```

Secondary capabilities exist contextually.

A physician should not think:

> "I need to open the Labs module."

They should think:

> "This patient's result needs my decision."

A physician should not think:

> "I need the Prescriptions module."

They should think:

> "I am completing the plan for this encounter."

The UI must reflect that difference.

---

# 5. NEW APPLICATION SHELL — STRUCTURAL REQUIREMENT

The old feature-warehouse sidebar must be retired from the primary physician experience.

Do NOT merely rename it.

## Desktop shell

Build a coherent four-layer shell:

### Layer 1 — Instrument Strip

Persistent, thin clinical/system state at top.

Contains only peripheral state:

- current patient;
- encounter state;
- recording state when active;
- autosave/sync;
- clinic/location if relevant;
- lightweight safety state.

It must not become a second navigation bar.

### Layer 2 — Flow Rail

A minimal context rail, maximum 4–5 physician destinations:

- Today;
- Patients;
- Follow-up / Work;
- Search / Command;
- More only when truly necessary.

Administrative destinations live in a separate Operations area.

The Flow Rail is NOT a list of modules.

### Layer 3 — Active Clinical Canvas

The center of the product.

This is where the current job happens.

It changes meaningfully by context:

- Today;
- Patient;
- Encounter;
- Results/Closure;
- Follow-up.

### Layer 4 — Contextual Lens

Optional transient panel.

Appears only when useful for:

- provenance;
- evidence;
- AI insight;
- detailed source;
- comparison;
- secondary action.

It must NOT be a permanently open "AI Copilot" sidebar.

---

# 6. TODAY — NOT A DASHBOARD

The home screen must not be a KPI/card dashboard.

It should behave as an operational clinical canvas.

Required zones:

## NOW

Current time and current/next encounter.

## TODAY

A temporal schedule that can be scanned vertically.

## NEEDS ATTENTION

Owned unresolved clinical work.

## CONTINUITY

Items that crossed encounters:

- result awaiting action;
- follow-up;
- medication change needing review;
- referral;
- patient question;
- pending course review.

## PREPARED BY NEXUS

Context prepared for upcoming patients.

Do not represent these as six equal cards.

Use hierarchy, lanes, timeline, rows, inline expansion, progressive disclosure.

---

# 7. PATIENT WORKSPACE — ONE PATIENT, ONE SPACE

Opening a patient must not launch a collection of independent tabs that feel like mini-apps.

Create a persistent patient workspace.

## Patient anchor

Always visible:

- identity;
- age/sex where relevant;
- allergy/safety;
- current encounter;
- last meaningful change.

## Clinical Spine

A longitudinal structural element, not a generic activity feed.

It should allow movement through:

- encounters;
- diagnoses;
- medications;
- labs;
- microbiology;
- imaging;
- procedures;
- orders;
- results;
- decisions;
- follow-ups;
- communications.

## Active Patient Canvas

The clinician can open an event/task/note without losing patient context.

## Contextual Lens

Source/evidence/AI detail when requested.

No route should mentally reset the physician.

---

# 8. ENCOUNTER MODE — A DISTINCT PRODUCT MODE

Starting a consultation transforms the interface.

It should NOT look like ordinary chart browsing with a recorder bolted on.

Required behavior:

1. navigation visually quiets;
2. patient identity remains unmistakable;
3. recording state becomes unmistakable;
4. clinically important current context remains available;
5. nonessential admin disappears;
6. one primary action dominates;
7. live transcript is optional, not the default wall;
8. contextual intelligence appears beside relevant facts;
9. note/plan emerge from the encounter without switching to unrelated modules.

Encounter lifecycle:

```text
PREPARE
→ START
→ LISTEN / CAPTURE
→ REVIEW FACTS
→ BUILD PLAN
→ REVIEW NOTE
→ PRESCRIPTION / ORDERS
→ VISIT PACKAGE
→ FOLLOW-UP
→ CLOSE
```

The interface should morph through these states rather than repeatedly sending the user to unrelated pages.

---

# 9. RESULTS / CLOSURE WORKSPACE

Do not design results as a static table alone.

Design a work queue.

Each item exposes:

```text
RESULT
→ SIGNIFICANCE
→ OWNER
→ REVIEW
→ DECISION
→ ACTION
→ PATIENT COMMUNICATION
→ CLOSED
```

Use status progression and next action.

The physician should see what is unresolved, not just what exists.

---

# 10. FOLLOW-UP / WORK

This is not a notifications page.

It is a closure queue.

Group by action state, not by arbitrary module:

- needs review;
- waiting on patient;
- waiting on result;
- needs scheduling;
- needs communication;
- needs signature;
- overdue;
- closed recently.

Every item answers:

```text
WHY IS THIS HERE?
WHO OWNS IT?
WHAT HAPPENED?
WHAT IS NEXT?
```

---

# 11. OPERATIONS IS SEPARATE FROM CLINICAL WORK

Administrative surfaces remain available but must not dominate physician navigation.

Operations may contain:

- payments;
- analytics;
- subscription;
- staff;
- templates;
- clinic settings;
- integrations;
- administrative reports.

Do not mix these with the physician's current clinical action queue.

---

# 12. GREYBOX GATE — NO MORE COLOR-ONLY REDESIGNS

This is mandatory.

Before brand styling is considered, every critical screen must pass a **greybox structural review**.

Temporarily evaluate the screen with:

- neutral grayscale;
- no brand color;
- no decorative shadow;
- no branded iconography;
- no gradients;
- minimal radius.

Ask:

```text
Has the information architecture changed?
Has the layout changed?
Has the hierarchy changed?
Has the interaction model changed?
Would this still feel different from the old product if all color disappeared?
```

If NO:

THE REDESIGN FAILS.

Do not proceed to visual polish.

This gate exists specifically to prevent reskinning.

---

# 13. SILHOUETTE TEST

Blur or visually defocus the screenshot.

The hierarchy should remain obvious.

The reviewer must still identify:

- patient/context;
- primary action;
- main content;
- secondary content;
- unresolved work.

If every region has equal visual weight, FAIL.

---

# 14. FEATURE-MENU TEST

Hide labels/icons and inspect the shell.

If its structure is still:

```text
many equally weighted destinations
→ separate module
→ separate module
→ separate module
```

FAIL.

Primary physician navigation target:

```text
<= 5 top-level destinations
```

Do not hide 20 modules inside a hamburger and call it solved.

Secondary capabilities must be contextualized.

---

# 15. INFORMATION ARCHITECTURE RULES

Every primary destination must represent one of:

- temporal context;
- patient context;
- active clinical work;
- unresolved work;
- operations.

Never create a top-level destination because a feature exists.

Before adding navigation ask:

```text
Is this a place the clinician conceptually GOES,
or a capability they USE inside another job?
```

Capabilities stay contextual.

Destinations define mental model.

---

# 16. VISUAL HIERARCHY

Each viewport should have:

1. one dominant context;
2. one dominant task;
3. clear secondary information;
4. tertiary metadata;
5. administrative controls visually subordinate.

Do not use:

- equal card emphasis;
- equal button emphasis;
- equal heading emphasis;
- excessive badges;
- border boxes to manufacture hierarchy.

Prefer:

```text
position
→ typography
→ whitespace
→ grouping
→ emphasis
```

before containers.

---

# 17. COMPONENT SYSTEM — SEMANTIC, NOT GENERIC

Do not build a generic component library first.

Build repeated clinical primitives only after usage is proven.

Candidate signature primitives:

- `NexusInstrumentStrip`
- `NexusFlowRail`
- `NexusPatientAnchor`
- `NexusClinicalSpine`
- `NexusEncounterCanvas`
- `NexusInsight`
- `NexusSourceReveal`
- `NexusClosureTrack`
- `NexusCourseBar`
- `NexusActionRow`
- `NexusWorkQueue`
- `NexusVisitPackage`
- `NexusSeal`
- `NexusCommand`

Do not rename `Card` to `NexusCard`.

If the primitive does not encode NexusMED-specific interaction or meaning, it is not a signature component.

---

# 18. DESIGN SYSTEM ORDER OF OPERATIONS

Mandatory order:

```text
1. INFORMATION ARCHITECTURE
2. TASK FLOW
3. LAYOUT
4. RESPONSIVE MODEL
5. COMPONENT BEHAVIOR
6. VISUAL HIERARCHY
7. DESIGN TOKENS
8. MOTION
9. POLISH
```

Never invert this order.

Identity Lock colors/fonts remain available, but V15 may not treat application of those tokens as completion of a redesign.

---

# 19. INTERACTION DESIGN

Every important element must answer:

- what happens on click/tap;
- hover/focus;
- keyboard;
- loading;
- success;
- error;
- disabled;
- empty;
- stale;
- offline/degraded;
- undo/recovery.

Prefer direct manipulation when safe.

Examples:

- schedule reschedule;
- inline medication correction;
- note section reordering;
- timeline filtering;
- result action;
- follow-up completion.

Avoid modal chains.

Use Undo for Tier 0–1 reversible actions.

Use explicit review for consequential actions.

---

# 20. CONTINUITY CHOREOGRAPHY

Navigation should communicate continuity.

Examples:

```text
Today appointment
→ Patient workspace
→ Encounter
```

should feel like the same object becoming more detailed.

```text
Result queue
→ Patient result
→ Source
```

should preserve spatial/contextual relationship.

Do not animate for decoration.

Transitions must be interruptible.

---

# 21. SOURCE REVEAL

Source/provenance should be a signature interaction.

A clinical statement may reveal its source without leaving the workflow.

Pattern:

```text
fact / insight
→ inspect
→ source segment/document/result
→ return exactly where you were
```

No context loss.

---

# 22. MOBILE IS NOT SHRUNK DESKTOP

Design mobile first for mobile jobs.

Mobile primary jobs:

- see next patient;
- start encounter;
- pause/resume recording;
- review generated note;
- approve/correct key facts;
- review result;
- sign/close appropriate actions;
- patient communication draft/review;
- schedule/follow-up quick action.

Do not expose the complete desktop navigation tree on mobile.

Mobile should have one-handed ergonomics and clear bottom/edge actions when appropriate.

---

# 23. RESPONSIVE BEHAVIOR

Define behavior for:

- wide desktop;
- standard desktop;
- narrow laptop;
- tablet;
- phone.

Do not merely wrap columns.

Each breakpoint must define:

- what remains persistent;
- what becomes contextual;
- what collapses;
- what becomes sheet/drawer;
- primary action placement;
- navigation model;
- safe-area/touch behavior.

---

# 24. ACCESSIBILITY

Required:

- semantic HTML;
- visible focus;
- keyboard complete;
- screen-reader labels;
- logical focus order;
- reduced motion;
- non-color state;
- contrast;
- touch targets;
- zoom resilience;
- long Spanish string resilience;
- no critical truncation.

Accessibility defects on critical clinical actions are blockers.

---

# 25. CONTENT DESIGN

Use concise, medical, human language.

Destinations use nouns.

Actions use verbs.

Avoid:

- AI marketing language inside workflow;
- verbose tooltips compensating for bad structure;
- unexplained jargon for patients;
- unnecessary "smart", "AI-powered", "intelligent" labels.

AI should be experienced through behavior.

---

# 26. DESIGN REVIEW PANEL

Use independent roles:

- Product Design Director;
- Principal UX Designer;
- Staff Design Engineer;
- Interaction Designer;
- Clinical Workflow Architect;
- Human Factors Reviewer;
- Accessibility Reviewer;
- Mobile UX Reviewer;
- Visual Originality Red Team.

The implementing agent may not be the sole approver.

For every critical screen the panel must answer:

```text
STRUCTURE CHANGED: YES/NO
IA CHANGED: YES/NO
LAYOUT CHANGED: YES/NO
INTERACTION CHANGED: YES/NO
GENERIC APP RISK:
WORKFLOW REGRESSION:
LOGIC REGRESSION:
```

If the first four are not meaningfully YES where appropriate, it is not a V15 redesign.

---

# 27. COMPETITOR BLIND TEST

For critical flows create a blind comparison packet using current public evidence where legally available.

Do not show brand names to the reviewer.

Ask:

- Which product makes the current task clearest?
- Which requires less navigation reconstruction?
- Which preserves context best?
- Which makes the next action clearest?
- Which feels most coherent?
- Which feels most generic?
- Which appears designed around a physician's job rather than feature inventory?

NexusMED may not self-award superiority.

---

# 28. LOGO-OFF TEST

Hide:

- logo;
- name;
- brand icon;
- marketing text.

A critical NexusMED screen should remain recognizable through:

- shell;
- layout;
- hierarchy;
- clinical spine;
- instrument strip;
- closure interaction;
- encounter mode;
- continuity choreography.

If recognizability depends only on colors/fonts/logo, FAIL.

---

# 29. GENERIC-AI-APP TEST

Score 0–10 probability that the screen looks like:

- Claude;
- v0;
- Lovable;
- Bolt;
- Replit;
- generic Tailwind/shadcn SaaS;
- generic medical admin template.

Target:

```text
GENERIC_AI_LOOK_SCORE <= 1.0
```

Do not reduce the score solely because the palette is unusual.

Structural reasons must be documented.

---

# 30. TASK FLOW METRICS

For each golden flow measure:

- time to complete;
- clicks/taps;
- screen transitions;
- navigation reversals;
- context losses;
- duplicate entry;
- modal count;
- confirmations;
- recoveries;
- wrong-patient risk;
- unfinished-state ambiguity.

Optimization target:

```text
minimum cognitive reconstruction
```

not blindly minimum clicks.

---

# 31. CORE GOLDEN FLOW BUDGETS

Measure baseline first.

Then V15 must improve or preserve safety for:

1. Next patient → start encounter.
2. Existing patient → understand what changed.
3. Start/stop/pause recording.
4. Encounter → note review.
5. Note → prescription/orders.
6. Result → review → action → close.
7. Patient → longitudinal event → source → return.
8. Follow-up → schedule → close.
9. Mobile start encounter.
10. Interrupted consultation → exact recovery.

No V15 visual change may worsen a critical flow without documented owner-approved tradeoff.

---

# 32. SCREEN INVENTORY — REDESIGN ALL PRACTICE SURFACES

Do not stop after Home.

Inventory and redesign, as applicable:

- Login
- Signup
- Onboarding
- Today
- Agenda
- Patient search
- Patient list
- Patient workspace
- Patient summary
- Timeline
- Encounter
- Recorder
- Note
- Reasoning/intelligence
- Medications
- Prescription
- Orders
- Results
- Documents
- Follow-up
- Tasks/work queue
- Patient communication
- Patient Companion
- Payments
- Trial/subscription
- Operations
- Settings
- Mobile equivalents
- Empty/error/loading/degraded states

Hospital/ICU remain hidden unless shared primitives are affected.

---

# 33. V15 PHASES

## PHASE 0 — TRUTH + BASELINE

No redesign yet.

- inventory screens;
- capture current screenshots;
- map top-level IA;
- count primary navigation destinations;
- map golden flows;
- record current task metrics;
- identify card-grid/module-first patterns;
- establish before baseline.

Output must include a structural critique, not color critique.

## PHASE 1 — IA RE-ARCHITECTURE

Deliver:

- new sitemap;
- top-level destinations <= 5 for physician;
- contextual capability map;
- admin/operations separation;
- patient-context model;
- route compatibility plan.

Do not change brand colors yet.

## PHASE 2 — GREYBOX SHELL

Implement the new shell in grayscale/neutral form.

Required:

- Instrument Strip;
- Flow Rail;
- Active Clinical Canvas;
- Contextual Lens;
- operations separation.

Pass Greybox Gate before styling.

## PHASE 3 — TODAY

Rebuild Home/Today structurally.

No KPI dashboard.

## PHASE 4 — PATIENT WORKSPACE

Rebuild around Patient Anchor + Clinical Spine + Active Canvas.

## PHASE 5 — ENCOUNTER MODE

Create actual mode transformation.

## PHASE 6 — RESULTS + CLOSURE

Create action-state workflow UI.

## PHASE 7 — FOLLOW-UP / WORK

Create closure queue.

## PHASE 8 — NOTE + PLAN CONTINUITY

Make note/prescription/order transition part of encounter, not module hopping.

## PHASE 9 — MOBILE

Recompose for mobile jobs.

## PHASE 10 — VISUAL SYSTEM

Only after structural gates are green:

- apply Cantera + Instrument;
- typography;
- spacing;
- component polish;
- motion.

## PHASE 11 — WHOLE-PRODUCT COHERENCE

Redesign all remaining Practice screens.

## PHASE 12 — RED TEAM + REGRESSION

Blind, logo-off, generic-AI, accessibility, responsive and workflow testing.

---

# 34. STRUCTURAL COMPLETION GATE

A screen is NOT redesigned because its CSS changed.

A critical screen is V15-complete only if applicable evidence shows:

```text
IA_CHANGE: PASS
LAYOUT_CHANGE: PASS
HIERARCHY_CHANGE: PASS
INTERACTION_CHANGE: PASS
GREYBOX_GATE: PASS
SILHOUETTE_TEST: PASS
LOGO_OFF: PASS
GENERIC_AI_LOOK <= 1
DESKTOP: PASS
MOBILE: PASS
ACCESSIBILITY: PASS
FUNCTIONAL_EQUIVALENCE: PASS
WORKFLOW_REGRESSION: NONE
```

---

# 35. NO-DOCUMENTATION-ONLY RULE

After Phase 0/1:

Every autonomous run must change the runnable product when safe product work exists.

Documentation alone does not count as progress.

Do not spend a run creating:

- strategy docs;
- audit docs;
- design docs;
- state files;

unless they directly support an implementation that run.

Target:

```text
>= 80% of active implementation effort on runnable product + tests
<= 20% on documentation/state
```

This is an execution discipline, not a telemetry claim.

---

# 36. VISIBLE-PROGRESS CONTRACT

The owner must be able to SEE progress.

After every completed major screen or at least every coherent visual milestone:

produce:

- route changed;
- before screenshot;
- after screenshot;
- desktop;
- mobile;
- Greybox result;
- Logo-Off result;
- Generic-AI score;
- preview deployment URL when available;
- commit SHA.

Never report "visual progress" based only on changed source files.

---

# 37. PREVIEW-FIRST, NOT PRODUCTION-FIRST

V15 may create/use safe preview deployments if repository infrastructure supports them.

Do not deploy production automatically.

Every major visual milestone should be viewable in a preview before production merge.

A preview must identify:

```text
BRANCH
COMMIT SHA
BUILD STATUS
PREVIEW URL
```

---

# 38. BRANCH-SPRAWL BACKPRESSURE — HARD GATE

V15 must NOT recreate the branch/PR explosion.

Use ONE persistent V15 branch unless an exceptional recovery branch is required.

Rules:

- no new branch per run;
- no new PR per run;
- push every run to the same V15 branch;
- keep at most ONE active V15 integration PR;
- do not create new visual feature work when integration debt exceeds threshold;
- do not leave completed work stranded across dozens of branches.

Backpressure trigger:

If any of these are true:

```text
V15 open PRs > 1
OR
V15 branch has unresolved merge conflict
OR
V15 branch is materially behind canonical integration branch
OR
multiple routines are editing the same critical screen
```

then:

```text
STOP NEW UI WORK
→ CONSOLIDATE
→ REBASE/MERGE SAFELY
→ RUN GATES
→ RESTORE ONE CANONICAL BRANCH
→ CONTINUE
```

Never force-push protected history.

---

# 39. CONCURRENCY POLICY

Do not run V10, V14 visual redesign, and V15 structural redesign simultaneously on the same surfaces.

V15 becomes the canonical presentation/UX owner while active.

Other routines may work only where file ownership does not overlap.

If overlap exists:

- identify canonical owner;
- preserve validated behavior;
- avoid simultaneous edits;
- record conflict;
- consolidate before proceeding.

---

# 40. REAL BROWSER REQUIREMENT

Never approve a structural redesign from source alone.

For every critical screen:

- run real application;
- use realistic synthetic data;
- interact with it;
- navigate into it and back;
- test desktop;
- test mobile;
- test long content;
- test empty;
- test error;
- test loading;
- test keyboard/touch;
- screenshot it.

If browser tooling is unavailable:

mark:

```text
VISUAL_VERIFICATION: BLOCKED
```

Do not fabricate a visual score.

Continue safe nonvisual work, but do not mark the screen complete.

---

# 41. ORIGINALITY RED TEAM

Independent reviewer specifically searches for:

- generic SaaS shell;
- sidebar warehouse;
- cards as default;
- shadcn-demo appearance;
- AI-template design;
- competitor imitation;
- feature-first IA;
- useless motion;
- visual novelty without usability;
- color-only differentiation.

Every valid finding becomes a tracked defect.

---

# 42. FUNCTIONAL EQUIVALENCE TEST

Because logic is frozen:

For every migrated screen compare old vs new behavior.

Required:

- same data loads;
- same authorized actions;
- same clinical safety constraints;
- same drafts preserved;
- same persistence semantics;
- same audit consequences;
- same error behavior or safer;
- no silent clinical behavior change.

If logic changes accidentally, revert or isolate it.

---

# 43. V15 ITERATION SEQUENCE

Use this default order:

1. `V15-BASELINE-001`
2. `V15-IA-001`
3. `V15-SHELL-GREYBOX-001`
4. `V15-TODAY-001`
5. `V15-PATIENT-WORKSPACE-001`
6. `V15-ENCOUNTER-MODE-001`
7. `V15-RESULTS-CLOSURE-001`
8. `V15-FOLLOWUP-WORK-001`
9. `V15-NOTE-PLAN-CONTINUITY-001`
10. `V15-MOBILE-001`
11. `V15-VISUAL-SYSTEM-001`
12. `V15-REMAINING-SCREENS-001`
13. `V15-A11Y-001`
14. `V15-MOTION-001`
15. `V15-PERF-001`
16. `V15-ORIGINALITY-REDTEAM-001`
17. `V15-WORKFLOW-BENCHMARK-001`
18. `V15-FINAL-COHERENCE-001`
19. `V15-RELEASE-GATE-001`

Safety/data-integrity defects override order.

---

# 44. EVERY RUN

Every run:

```text
SYNC CANONICAL V15 BRANCH
→ READ CURRENT STATE
→ CHECK BRANCH/PR BACKPRESSURE
→ IDENTIFY EXACT NEXT SCREEN/FLOW
→ OPEN REAL APP
→ INSPECT CURRENT VERSION
→ IMPLEMENT STRUCTURAL CHANGE
→ RUN FUNCTIONAL EQUIVALENCE
→ TEST
→ REAL BROWSER
→ DESKTOP
→ MOBILE
→ GREYBOX / STRUCTURE GATE
→ ACCESSIBILITY
→ WORKFLOW CHECK
→ SCREENSHOTS
→ UPDATE STATE
→ COMMIT
→ PUSH SAME BRANCH
→ UPDATE PREVIEW
→ RECORD EXACT NEXT TASK
```

Do real work.

Do not re-plan completed work.

---

# 45. OWNER REPORT — EVERY RUN

Report concisely:

```text
ITERATION:
SCREEN / FLOW:
STRUCTURAL CHANGE:
IA_CHANGE: PASS/FAIL/NA
LAYOUT_CHANGE: PASS/FAIL/NA
INTERACTION_CHANGE: PASS/FAIL/NA
GREYBOX_GATE:
FUNCTIONAL_EQUIVALENCE:
DESKTOP:
MOBILE:
GENERIC_AI_LOOK_SCORE:
LOGO_OFF:
TESTS:
PREVIEW URL:
COMMIT:
PUSHED:
PR COUNT:
NEXT TASK:
V15_COMPLETE:
```

Do not report visual success without screenshot/browser evidence.

---

# 46. V15 COMPLETE

Create `agent-state/V15_COMPLETE.md` only when:

- primary physician navigation <=5 top-level destinations;
- feature-menu warehouse removed from primary physician IA;
- Today structurally redesigned;
- Patient Workspace structurally redesigned;
- Encounter Mode is a real distinct mode;
- Results/Closure is action-state driven;
- Follow-up is a work/closure queue;
- note/prescription/orders are integrated into encounter continuity;
- desktop/mobile critical flows pass;
- all critical screens pass Greybox;
- all critical screens pass Logo-Off;
- critical Generic-AI score <=1;
- accessibility passes;
- functional equivalence passes;
- no unresolved V15 P0;
- no V15-blocking P1;
- one canonical V15 branch/PR state;
- screenshots/previews exist for all critical screens.

V15_COMPLETE means structural UI/UX re-architecture is complete.

It does NOT mean production deployment is automatic.

---

# 47. INSTALL PROMPT

Paste this into Claude together with this file:

```text
INSTALL NEXUSMED V15 — STRUCTURAL UI/UX RE-ARCHITECTURE.

The attached V15 file is now the authoritative specification for
NexusMED Practice presentation architecture, information architecture,
layout, interaction design, responsive behavior and visual system.

READ IT COMPLETELY.

Critical intent:

THIS IS NOT A COLOR REDESIGN.

Do not satisfy V15 by changing palette, typography, radius or shadows.

V15 must structurally redesign:

- Information Architecture
- primary navigation
- application shell
- layout
- hierarchy
- interaction model
- patient workspace
- encounter mode
- Today
- results/closure
- follow-up/work
- mobile composition

while preserving existing validated clinical/business logic.

Install at exactly:

docs/ai/NEXUSMED_MASTER_LOOP_V15_STRUCTURAL_UIUX_REARCHITECTURE.md

V15 supersedes V10/V14 presentation-redesign instructions when they
conflict, but preserves their safety, evidence, clinical-truth and
Identity Lock constraints.

IMPORTANT BRANCH RULE:

Do not create branch sprawl.

Use one canonical V15 branch derived from the current reconciled
integration branch.

Do not create one branch or PR per run.

Before implementation:

1. inspect current branch/PR state;
2. if integration debt is still unresolved, consolidate first;
3. record current screenshots and workflow baselines;
4. install V15 state;
5. do NOT touch production.

Then execute:

V15-BASELINE-001
→ V15-IA-001
→ V15-SHELL-GREYBOX-001

Do NOT apply visual polish first.

The new shell must pass in grayscale before brand styling is considered.

Do not ask me cosmetic questions.
Make strong reversible professional decisions.

Do not change clinical/business logic.

Do not stop with documentation if safe runnable implementation exists.

At the end report:

V15_INSTALLED:
PATH:
CANONICAL_BRANCH:
OPEN_V15_PRS:
BASELINE_CAPTURED:
CURRENT_ITERATION:
CURRENT_SCREEN/FLOW:
IA_CHANGE:
LAYOUT_CHANGE:
INTERACTION_CHANGE:
GREYBOX_GATE:
FUNCTIONAL_EQUIVALENCE:
PREVIEW_URL:
COMMIT:
PUSHED:
NEXT_TASK:
V15_COMPLETE:
```

---

# 48. CLOUD ROUTINE PROMPT

Use this as the recurring Claude Cloud routine instruction:

```text
NEXUSMED V15 — STRUCTURAL UI/UX RE-ARCHITECTURE

FIRST ACTION EVERY RUN:

Read completely:

docs/ai/NEXUSMED_MASTER_LOOP_V15_STRUCTURAL_UIUX_REARCHITECTURE.md

Then read:

- CLAUDE.md
- agent-state/V15_*
- current Git history
- current branch/PR state
- current screenshots
- current preview
- relevant tests

V15 owns UI/UX structure while active.

Do not restart.
Continue exactly where the previous run stopped.

HARD RULE:

Do not mistake a reskin for a redesign.

Every critical redesign must materially address, where applicable:

INFORMATION ARCHITECTURE
+ LAYOUT
+ HIERARCHY
+ INTERACTION

before color/font/motion polish.

Preserve clinical/business logic.

Do not create new branches or PRs per run.
Use the one canonical V15 branch.

If integration/PR debt is detected:
STOP NEW UI WORK and consolidate first.

Each run should perform runnable product work when safe work exists.

Required cycle:

SYNC
→ CHECK BACKPRESSURE
→ INSPECT REAL APP
→ IMPLEMENT NEXT STRUCTURAL TASK
→ FUNCTIONAL EQUIVALENCE
→ TEST
→ DESKTOP
→ MOBILE
→ GREYBOX GATE
→ ACCESSIBILITY
→ WORKFLOW CHECK
→ SCREENSHOT
→ COMMIT
→ PUSH SAME BRANCH
→ UPDATE PREVIEW
→ UPDATE STATE

Never deploy production automatically.
Never force-push.
Never use real patient data.
Never modify production Stripe.
Never change clinical truth for aesthetics.
Never fabricate visual scores.

At the end report:

ITERATION:
SCREEN/FLOW:
STRUCTURAL CHANGE:
IA_CHANGE:
LAYOUT_CHANGE:
INTERACTION_CHANGE:
GREYBOX_GATE:
FUNCTIONAL_EQUIVALENCE:
GENERIC_AI_LOOK_SCORE:
DESKTOP:
MOBILE:
TESTS:
PREVIEW_URL:
COMMIT:
PUSHED:
PR_COUNT:
NEXT_TASK:
V15_COMPLETE:
```

---

# 49. FINAL DIRECTIVE

The target is NOT:

> "NexusMED with nicer colors."

The target is NOT:

> "Huli/Nexus Med with a different theme."

The target is NOT:

> "Abridge/Suki/Nabla copied into a Practice Management shell."

The target is:

```text
A clinically coherent Patient Continuity Workspace
with a recognizable interaction grammar of its own.
```

A physician should feel:

> "I always know which patient I am in."

> "I always know what needs attention."

> "I never have to reconstruct where I was."

> "The software follows the clinical work."

> "This does not look or behave like a generic medical SaaS."

**STRUCTURE BEFORE SKIN.**
