# Phase 60 — Atomic Bulk Catalog Pricing

The Author dashboard submits the full validated preview to one guarded RPC. The database validates all product IDs and integer Rupiah values, takes row locks, persists supplier cost (including Rp0 when explicitly supplied), updates selling prices, and records audit rows in one transaction. Any invalid row or database error aborts the entire valid batch—there is no partial-success state within the transaction.

## Limits and behavior
- Maximum 2,000 packages per RPC.
- Missing or null supplier cost means preserve the existing value; numeric `0` is a real value.
- CSV with supplier_cost and blank price is pre-calculated at the established 7% markup in the dashboard preview.
- Manual price in CSV is respected as entered.
- Invalid CSV rows are listed separately; valid preview rows are submitted together after Author confirmation.
- Network/response uncertainty must be resolved by refreshing the catalogue before retrying.

## Deploy order
Apply Phase 60 only after Phase 57A/57B, Phase 58 and Phase 59 are installed, then deploy the matching frontend. Run a small three-product test before the full catalogue import. No catalogue values are seeded by this migration.