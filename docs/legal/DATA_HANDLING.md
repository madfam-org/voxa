# Data handling

| Data | Stored | Retention | Sharing |
|------|--------|-----------|---------|
| Janua identity (sub, email) | Session + API audit | Account lifetime | Janua (auth only) |
| Communication boards | PostgreSQL (when `DATABASE_URL` set) | Until deleted / account closure | No third-party sale |
| Utterance context for AI | Not stored by default | N/A until LLM MVP | Only if user opts in |
| Service logs | Enclii / cluster | Platform retention policy | Infrastructure providers |

Do not put diagnoses, medications, or other PHI in board labels unless your organization has a BAA with MADFAM.

AAC test fixtures must use synthetic names only (see CONTRIBUTING.md).
