<div align="center">

# Proof

**Permanent, publication-grade evidence and credential presentation layer.**

Turn certificates, achievements, documents, and project evidence into permanent, professional, shareable pages at `proof.tyes.dev/@username/slug`.

[![Tests](https://img.shields.io/badge/tests-393%20passed-2ea44f?style=flat-square)](https://github.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178c6?style=flat-square)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15%20App%20Router-black?style=flat-square)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon%20Serverless-00e699?style=flat-square)](https://neon.tech)
[![Storage](https://img.shields.io/badge/Storage-Cloudflare%20R2-f38020?style=flat-square)](https://cloudflare.com)
[![Auth](https://img.shields.io/badge/Auth-Clerk-6c47ff?style=flat-square)](https://clerk.com)

[Live Deployment](https://proof.tyes.dev) &bull; [Architecture](#architecture--system-topology) &bull; [Quickstart](#quickstart--local-development) &bull; [Features](#key-capabilities) &bull; [Security Model](#security--trust-invariants)

</div>

---

## What is Proof?

Proof solves the credential and portfolio fragmentation problem. Today, professional credentials, achievements, licenses, certificates, and work evidence are scattered across PDFs on local hard drives, clunky issuer portals, or compressed into low-resolution LinkedIn thumbnails.

**Proof is an evidence and presentation layer.** It transforms verified credentials and user-supplied documentation into permanent, high-performance, mobile-responsive editorial web pages.

> [!IMPORTANT]
> **Proof is not a credential issuer and does not independently verify arbitrary uploaded documents.**  
> Proof strictly separates user-uploaded evidence (`SELF_REPORTED`) from issuer-verified credentials (`ISSUER_VERIFIED`). The term **"Verified"** is cryptographically protected and only applied when backed by verified issuer records.

---

## Key Capabilities

### 1. Editorial Presentation & Document Viewer
- **Server-Side Rendered (SSR):** High-speed edge rendering with Next.js App Router and Incremental Static Regeneration (`revalidate = 60`).
- **Native Document Frame:** Clean SVG/PDF preview canvas, document pagination, responsive metadata sidebar, and print-ready CSS (`@media print`).
- **Custom Vanity Handles:** Clean vanity URLs (`/@username` and `/@username/slug`) with 301 redirects on handle or slug renames.

### 2. Direct-to-R2 Quarantine Upload Pipeline
- **Zero-Proxy Uploads:** Clients upload files directly to Cloudflare R2 using presigned single and multipart URLs. App servers never bottleneck file streams.
- **Strict Quarantine Invariant:** All incoming uploads land in an isolated `quarantine/` prefix. Untrusted files cannot be previewed or downloaded until scanned and processed.

### 3. Two-Stage Malware & Structural Sandbox
- **Stage 1 (In-Process):** Magic-byte verification checks genuine file headers against declared MIME types. PDF structure inspection audits against `/JavaScript`, `/Launch`, `/EmbeddedFiles`, and malicious streams.
- **Stage 2 (Worker/Pipeline):** Antivirus scan hook, decompression bomb protection (pixel limits), and thumbnail/preview derivation before promoting assets to `READY`.

### 4. Canonical High-Contrast QR Code Engine
- **Vector & Raster Generation:** Dedicated endpoints (`/qr.svg` and `/qr.png`) rendering vector SVGs and 512px PNGs using high-contrast ink-on-paper palette tokens.
- **Strict Attribution:** QR codes encode the canonical URL with `?ref=qr` tracking query parameter. QR codes **never** embed raw document bytes.

### 5. Publishing Desk & Live Preview Parity
- **Split-Screen Desk:** Real-time editing with pixel-perfect preview parity against public proof pages.
- **Accessible Reordering:** Drag-and-drop and accessible keyboard-driven reordering for proofs index with live screen-reader status announcements.
- **Optimistic State Management:** Local UI updates apply optimistically and automatically reconcile/roll back if network mutation fails.

### 6. Privacy-First Analytics Engine
- **No Indefinite Raw IP Storage:** Visitor IP addresses are immediately discarded after computing a daily-rotating HMAC-SHA256 salted hash. Hashes cannot be linked across calendar days.
- **Automated Bot Filtering:** Web crawlers, scrapers, and headless engines are automatically filtered from public metrics.
- **Aggregated Dashboards:** Publisher analytics query pre-aggregated daily summaries (`analytics_daily`), never raw row tables.

### 7. Search, Discovery & SEO
- **Structured Data (JSON-LD):** Implements Schema.org `Person` and `EducationalOccupationalCredential` specifications for rich search snippets.
- **Dynamic SEO:** Automated `sitemap.xml`, `robots.txt`, OpenGraph cards, Twitter cards, and `noindex` directives for unlisted or private proofs.

---

## Architecture & System Topology

Proof is designed as a **modular monolith** emphasizing strict boundaries, database-backed authority, and low operational overhead.

```mermaid
flowchart TD
    Client["Browser / Client Device"]
    EdgeCDN["Cloudflare Edge CDN / Reverse Proxy"]
    AppServer["Next.js App Server (proof.tyes.dev)"]
    ClerkAuth["Clerk Identity Provider"]
    NeonDB[("Neon Serverless PostgreSQL")]
    R2Storage[("Cloudflare R2 Object Storage")]

    Client -->|"1. HTTPS Request"| EdgeCDN
    EdgeCDN -->|"2. Edge Cache Hit (s-maxage=60)"| Client
    EdgeCDN -->|"3. Origin SSR / API"| AppServer

    AppServer <-->|"Session Auth / JWT"| ClerkAuth
    AppServer <-->|"Authority: Users, Proofs, Constraints"| NeonDB
    AppServer -->|"Presigned Upload URLs"| Client

    Client -->|"4. Direct Upload into /quarantine"| R2Storage
    AppServer -->|"5. Scan, Process & Promote to /published"| R2Storage
```

### Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Framework** | [Next.js 15](https://nextjs.org/) (App Router, React 19) | Server-side rendering, API route handlers, Edge CDN integration |
| **Language** | [TypeScript](https://www.typescriptlang.org/) (Strict mode) | Type safety across entire data and presentation layer |
| **Database** | [Neon](https://neon.tech/) Serverless PostgreSQL | System authority for handles, proofs, ACID constraints, and migrations |
| **ORM & Migrations** | [Drizzle ORM](https://orm.drizzle.team/) & Drizzle Kit | Type-safe SQL builder with forward and rollback migration files |
| **Authentication** | [Clerk](https://clerk.com/) | Authentication sessions only (handle ownership is 100% in PostgreSQL) |
| **Object Storage** | [Cloudflare R2](https://cloudflare.com/) (S3-compatible) | Presigned uploads, quarantine isolation, originals and thumbnails |
| **Styling** | Custom Design Tokens (`design/tokens.css`) + Tailwind | High-contrast Editorial Utility palette, typography, and dark mode tokens |
| **Testing** | [Vitest](https://vitest.dev/) + React Testing Library | Unit, integration, database constraints, performance, and E2E suites |

---

## Security & Trust Invariants

Proof operates under explicit, non-negotiable architectural guarantees:

1. **Database is Authority:**  
   Application validation is for user experience; database constraints (`UNIQUE`, foreign keys with `ON DELETE CASCADE`, check constraints, enums) are the ultimate guarantee.
2. **"Verified" is Protected:**  
   User-uploaded documents are labeled `SELF_REPORTED` or `ISSUER_REFERENCED`. Only cryptographically confirmed, issuer-controlled flows set `ISSUER_VERIFIED`.
3. **Quarantine by Default:**  
   Files uploaded by clients land in `quarantine/`. App routes refuse to generate download or preview URLs for any asset not in `READY` status.
4. **Hardened HTTP Headers:**  
   Every response includes Content Security Policy (CSP), HTTP Strict Transport Security (HSTS), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and `Permissions-Policy`.
5. **Anti-IDOR & Anti-Mass-Assignment:**  
   Update schemas enforce strict key whitelisting; ownership checks (`userId = auth.userId`) are enforced in the database query `WHERE` clauses.

---

## Performance Benchmarks

Performance targets defined in `docs/testing-strategy.md` are empirically tested and verified via the benchmark engine (`pnpm run db:benchmark`):

| Path / Scenario | Target Budget | Measured Performance | Margin |
|---|---|---|---|
| **Username Availability (100 concurrent)** | $p95 < 150\text{ ms}$ | **4.01 ms** | **37.4x faster** |
| **Ordinary API Reads (100 concurrent)** | $p95 < 300\text{ ms}$ | **5.84 ms** | **51.3x faster** |
| **Concurrent Handle Claims (1,000 requests)** | Exactly 1 winner | **1 winner (201), 999 taken (409)** | **100% atomic** |
| **Scale Tier Working Set (100k users, 1M proofs)** | Fits in 1 GB RAM buffer pool | **~998 MB** | **Fits in 1 GB RAM** |
| **Edge CDN Cache Ratio (Public Pages)** | $> 90\%$ cache hit | **91.8%** | **Budget satisfied** |

Detailed query plans, B-Tree depth analysis, and scale tier models can be inspected in [`benchmark.md`](./benchmark.md).

---

## Quickstart & Local Development

### Prerequisites
- **Node.js:** `>= 20.0.0`
- **Package Manager:** `pnpm` (`npm install -g pnpm`)
- **PostgreSQL:** Neon database instance (or any PostgreSQL connection string)

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/proof.git
cd proof
```

### 2. Install Dependencies
```bash
pnpm install
```

### 3. Configure Environment Variables
Copy the template configuration file:
```bash
cp .env.example .env.local
```

Fill in your connection details in `.env.local`:
```bash
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Database
DATABASE_URL="postgresql://user:password@ep-direct...neon.tech/proof?sslmode=require"
DATABASE_POOL_URL="postgresql://user:password@ep-pooler...neon.tech/proof?sslmode=require"

# Auth (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
CLERK_WEBHOOK_SECRET="whsec_..."

# Storage (Cloudflare R2)
R2_ACCOUNT_ID="your_account_id"
R2_ACCESS_KEY_ID="your_access_key_id"
R2_SECRET_ACCESS_KEY="your_secret_access_key"
R2_BUCKET_NAME="proof-assets"
R2_QUARANTINE_BUCKET_NAME="proof-quarantine"
```

### 4. Run Migrations & Seed Data
```bash
# Apply schema to database
pnpm run db:migrate

# Optional: Seed initial system issuers and reserved handle protection
pnpm run db:seed
```

### 5. Start Development Server
```bash
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## Available Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Starts the Next.js local development server |
| `pnpm build` | Compiles an optimized Next.js production build |
| `pnpm start` | Runs the compiled production build locally |
| `pnpm test` | Runs the complete Vitest test suite (393 tests) |
| `pnpm test:watch` | Starts Vitest in interactive watch mode |
| `pnpm typecheck` | Validates TypeScript types across the entire project (`tsc --noEmit`) |
| `pnpm lint` | Runs ESLint rules across all files |
| `pnpm format` | Checks file formatting with Prettier |
| `pnpm format:fix` | Formats all files with Prettier |
| `pnpm db:generate` | Generates Drizzle migration files from `schema.ts` |
| `pnpm db:migrate` | Runs forward SQL migrations against PostgreSQL |
| `pnpm db:rollback` | Executes reverse rollback migration (`CASCADE`) |
| `pnpm db:seed` | Seeds system issuers, reserved names, and sample proofs |
| `pnpm db:benchmark` | Runs synthetic load test and query execution plan analysis |

---

## Production Health & Observability

Proof includes built-in operational probes for orchestrator health checks and load balancers:

- **Liveness Probe:** `GET /healthz`  
  Returns HTTP 200 with process status and uptime. Bypasses authentication and edge caching.
- **Readiness Probe:** `GET /readyz`  
  Executes deep connectivity checks against PostgreSQL (`SELECT 1`), Cloudflare R2 storage credentials, and queue workers. Returns HTTP 200 when ready, HTTP 503 when degraded.

---

## Repository Structure

```
proof/
├── design/                 # Visual design system tokens (tokens.css)
├── docs/                   # Specifications, architecture, data model, security
│   ├── architecture.md     # Runtime, storage, caching, and topology
│   ├── data-model.md       # DDL, indexes, constraints, and state machines
│   ├── operations.md       # Operational runbooks & launch checklist
│   └── security-model.md   # Threat checklist, sandbox, anti-abuse
├── src/
│   ├── app/                # Next.js App Router (pages, API routes, layout)
│   │   ├── api/            # REST API endpoints (proofs, uploads, events, admin)
│   │   ├── u/[handle]/     # Public profile & proof pages (/@username/slug)
│   │   ├── healthz/        # Liveness probe
│   │   └── readyz/         # Readiness probe
│   ├── components/         # Accessible React UI components (editor, viewer, UI)
│   ├── db/                 # Drizzle schemas, migrations, seeds, rollback scripts
│   ├── lib/                # Shared utilities (slug, handle, validation, storage)
│   └── services/           # Core business domain services (identity, proof, trust)
└── benchmark.md            # Empirical performance and scalability benchmark report
```

---

## License

This project is licensed under the [MIT License](LICENSE).
