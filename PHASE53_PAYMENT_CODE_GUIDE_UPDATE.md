# Phase 53 guide update for Phase 54

The earlier Phase 53 guide documented Rp101–Rp999. The current approved rule is **Rp200–Rp999**. Apply the Phase 54 migration before relying on that new range. Phase 54 uses CREATE OR REPLACE for the seven-argument RPC so it can run after Phase 53 without a duplicate-function error. Do not rerun the Phase 53 migration after Phase 54, or it may restore the old range.
