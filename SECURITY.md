# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| 0.5.x   | Yes |
| < 0.5   | No |

## Reporting a vulnerability

Email **security@madfam.io** with:

- Description of the issue and impact
- Steps to reproduce
- Affected URLs or versions

Do **not** open public GitHub issues for security reports.

We aim to acknowledge reports within **3 business days** and provide a remediation timeline for confirmed issues.

## Scope

In scope:

- `voxa.madfam.io`, `voxa-api.madfam.io`, and staging equivalents
- `madfam-org/voxa` source code
- Authentication, authorization, and board data handling in the API

Out of scope:

- Third-party AAC hardware firmware
- Issues requiring physical access to a user's dedicated communication device

## Safe harbor

Good-faith security research that follows this policy will not be pursued legally by MADFAM, provided you do not access other users' data, degrade service availability, or disclose issues publicly before we address them.

## Data handling

Voxa is an AAC communication platform. Do not include real user utterances, diagnoses, or other sensitive health information in bug reports or test fixtures.
