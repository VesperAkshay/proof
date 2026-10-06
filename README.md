# Proof (`proof.so`)

> Permanent, professional, publication-grade proof and evidence pages at `proof.so/@username/slug`.

## Core Architecture & Stack
- **Framework:** Next.js (App Router) + React 19 + TypeScript (Strict)
- **Design System:** Editorial Utility — single source of truth in `design/tokens.css`
- **Database:** Neon Serverless PostgreSQL (no Docker). Authority for handles, metadata, constraints.
- **Authentication:** Clerk for authentication sessions/identity only. Handle ownership is 100% authoritative in Proof Postgres DB (`users.username_normalized`).
- **Storage:** Cloudflare R2 (S3-compatible) with direct client presigned/multipart upload into quarantine prefix.
- **Queue:** `pg-boss` running natively in Neon PostgreSQL.
- **Malware Scanning:** 2-Stage Pipeline (in-process magic bytes/PDF structure validation + pluggable antivirus interface).
- **Package Manager:** `pnpm` (Node >= 20.x).

## Milestones Roadmap
- **M0:** Product contract & repository foundation [COMPLETED]
- **M1:** Database foundation (Neon schema, migrations, constraints) [COMPLETED]
- **M2:** Identity & Proof handle (`@username` availability, claiming, concurrent safety) [COMPLETED]
- **M3:** Profile system (`/@username` public display, bio, selected proofs, SEO, 301 redirects) [COMPLETED]
- **M4:** Proof creation & lifecycle state machine [COMPLETED]
- **M5:** File system (R2 direct upload, presigned/multipart, quarantine, magic bytes, scanning) [COMPLETED]
- **M6:** Document processing & thumbnail generation [COMPLETED]
- **M7:** Public proof page (`/@username/slug`, SSR, document viewer, download, print-friendly) [COMPLETED]
- **M8 – M9:** Verification architecture & QR sharing
- **M10 – M18:** Editor, analytics, SEO, abuse/takedown, performance, security audit, and launch
