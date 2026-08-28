# AUSCULTA manual assist lock — Evidence #314

STATUS=ACTIVE_MANUAL_ASSIST
OWNER=manual Claude lane
BASE_BRANCH=product/ausculta-master-completion
MANUAL_BRANCH=product/manual-evidence-314-2026-08-28
ASSIGNED_ITEMS=P1-9 Evidence #314 consultation runtime; P1-10 PMC per-article license gate
DO_NOT_TOUCH=patient pagination; root collection importer/restore; mobile scroll; firestore.rules; Patient State; Closed Loop; GitHub workflows
NO_MAIN_MERGE=true
NO_PRODUCTION_DEPLOY=true
NO_PHI=true
NO_LICENSE_ACCEPTANCE=true

This branch is intentionally parallel to the autonomous loop.
Before integration, update from the latest product/ausculta-master-completion head,
resolve conflicts by preserving newer autonomous work, run mandatory gates, and
only then merge this PR into product/ausculta-master-completion.
