# Data handling

> Engineering summary of what the code does on `main` (2026-10-04). The policy that applies is the in-app privacy page, [voxa.madfam.io/legal/privacy](https://voxa.madfam.io/legal/privacy).

| Data | Stored | Retention | Sharing |
|------|--------|-----------|---------|
| Janua identity (sub, email) | Session + API audit | Account lifetime | Janua (auth only) |
| Communication boards | PostgreSQL (when `DATABASE_URL` set) | Until deleted / account closure | No third-party sale |
| Consent choices (word suggestions, usage counts) | PostgreSQL, per person and purpose, with an audit trail | Account lifetime | None |
| Usage counts (board and button ids) | PostgreSQL, only with the person's `usage_analytics` consent | Until the board owner deletes them or the board is deleted | None |
| Spoken text of activations | Not stored. Only for an organization with a data-processing agreement and a separate opt-in (none enabled today) | 90 days | None |
| Text sent for word suggestions | Not stored. Computed by Voxa's local predictor; no third-party AI service | N/A | None |
| Uploaded photos, recordings and videos | PostgreSQL | Until deleted with the board | None |
| Service logs | Enclii / cluster | Platform retention policy | Infrastructure providers |

Do not put diagnoses, medications, or other PHI in board labels unless your organization has a BAA with MADFAM.

AAC test fixtures must use synthetic names only (see CONTRIBUTING.md).
