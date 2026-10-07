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
- **M8:** Verification architecture (issuers, records, revocation, append-only audit trail) [COMPLETED]
- **M9:** QR & sharing (canonical SVG/PNG QR, ref=qr analytics tracking) [COMPLETED]
- **M10:** Profile/Proof editor (publishing desk, live preview parity, accessible reorder, optimistic updates) [COMPLETED]
- **M11:** Analytics (privacy-first, rotating salted visitor hash, coarse geo, daily aggregation, raw TTL, aggregate dashboard) [COMPLETED]
- **M12:** SEO / discovery (title, description, canonical @ URLs, OpenGraph, Twitter cards, Schema.org Person & EducationalOccupationalCredential JSON-LD, sitemap.xml, robots.txt, noindex for private/unlisted) [COMPLETED]
- **M13:** Abuse & trust (reporting proof/profile, abuse queue, takedown, suspension, spam heuristics, rate limiting, upload limits, suspicious activity detection, audit trail) [COMPLETED]
- **M14:** Performance engineering (latency budgets, 100 concurrent requests p95 < 150ms, 1k-100k users & 1M-10M proofs scale tier models, query plans, CDN ISR revalidate = 60 cache tuning) [COMPLETED]
- **M15:** Security audit (threat checklist review, anti-IDOR, magic byte validation, PDF structure sandbox, homograph rejection, strict anti-mass-assignment, global CSP/HSTS/X-Frame-Options headers, zero open High/Critical) [COMPLETED]
- **M16:** Production readiness (liveness /healthz, readiness /readyz, fail-fast boot validation, 7 operational runbooks, DB restore & rollback drills evidenced) [COMPLETED]
- **M17:** Load test (synthetic traffic: 10k concurrent visitors, 1k concurrent username checks, 500 uploads/min, 10k views/min, budgets met) [COMPLETED]
- **M18:** Launch candidate (full E2E lifecycle validated: signup → claim @username → create profile → create proof → upload PDF → scan → process → publish → open public URL → download → QR scan → analytics, all exit gates re-verified, launch signoff complete) [COMPLETED]
